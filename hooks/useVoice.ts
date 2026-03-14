import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAvatarStore } from '@/store/avatarStore';

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

// SpeechRecognition API types (since they're not in TypeScript's lib.dom.d.ts yet)
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (event: Event) => void;
  onaudiostart: (event: Event) => void;
  onaudioend: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: (event: Event) => void;
}

// Extend the Window interface to include SpeechRecognition types
declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognition };
    webkitSpeechRecognition?: { new (): SpeechRecognition };
  }
}

// Custom hook to manage Text-to-Speech and Speech-to-Text functionality
export const useVoice = () => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [hasTTS, setHasTTS] = useState<boolean>(false);
  const [hasSTT, setHasSTT] = useState<boolean>(false);
  const [hasUsableTTSVoice, setHasUsableTTSVoice] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [canRetrySTT, setCanRetrySTT] = useState<boolean>(false);
  const { setMood, setIsSpeaking, setIsListening, reset } = useAvatarStore();

  // Ref to hold the SpeechRecognition instance
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef<((finalText: string, isFinal: boolean) => void) | null>(null);
  const shouldContinueListeningRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInterimRef = useRef<string>('');

  // Support + voices check
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ttsSupported = 'speechSynthesis' in window;
    const sttSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    setHasTTS(ttsSupported);
    setHasSTT(sttSupported);
    setIsSupported(ttsSupported || sttSupported);
    if (!sttSupported) {
      console.warn('Speech-to-Text is unsupported in this browser.');
    }

    if (ttsSupported) {
      const updateVoices = () => {
        setHasUsableTTSVoice(window.speechSynthesis.getVoices().length > 0);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
      shouldContinueListeningRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      if (recognitionRef.current) recognitionRef.current.abort();
      reset();
    };
  }, [reset]);

  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Function to select the best available voice for TTS
  const getBestVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang.includes('en-US') && v.name.includes('Google')) ||
      voices.find((v) => v.lang.includes('en-US')) ||
      voices[0]
    );
  }, []);

  const pauseTTS = useCallback(() => {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsSpeaking(false);
      setMood('idle');
    }
  }, [setIsSpeaking, setMood]);

  const resumeTTS = useCallback(() => {
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsSpeaking(true);
      setMood('talking');
    }
  }, [setIsSpeaking, setMood]);

  // Text-to-Speech function
  const speak = useCallback(
    (text: string, pitch = 1.0, rate = 1.0, volume = 1.0) => {
      if (!hasTTS) return;

      // Stop any ongoing speech or recognition before starting new TTS
      window.speechSynthesis.cancel();
      setIsPaused(false);

      // Basic chunking logic for long texts (split by common punctuation)
      const maxChunkLength = 200;
      let chunks: string[] = [];

      if (text.length > maxChunkLength) {
        // Split by sentences roughly
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let currentChunk = '';

        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length <= maxChunkLength) {
            currentChunk += sentence;
          } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
          }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
      } else {
        chunks = [text];
      }

      const voice = getBestVoice();

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        if (voice) utterance.voice = voice;
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.volume = volume;

        if (index === 0) {
          utterance.onstart = () => {
            setIsSpeaking(true);
            setIsPaused(false);
            setMood('talking');
          };
        }

        if (index === chunks.length - 1) {
          utterance.onend = () => {
            setIsSpeaking(false);
            setIsPaused(false);
            setMood('idle');
          };
          utterance.onerror = () => {
            setIsSpeaking(false);
            setIsPaused(false);
            setMood('idle');
          };
        }

        utterance.onpause = () => {
          setIsPaused(true);
          setIsSpeaking(false);
          setMood('idle');
        };

        utterance.onresume = () => {
          setIsPaused(false);
          setIsSpeaking(true);
          setMood('talking');
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    [hasTTS, getBestVoice, setIsSpeaking, setMood]
  );

  const speakWithFallback = useCallback(
    async (text: string, pitch = 1.0, rate = 1.0, volume = 1.0) => {
      if (!hasTTS) return;

      if (hasUsableTTSVoice) {
        speak(text, pitch, rate, volume);
        return;
      }

      try {
        const data = await api.generateTTS(text);
        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          audio.volume = volume;
          // Note: HTML5 Audio doesn't natively support easy pitch shifting without Web Audio API.
          // Fallback limits to rate change.
          audio.playbackRate = rate;

          audio.onplay = () => {
            setIsSpeaking(true);
            setMood('talking');
          };
          audio.onended = () => {
            setIsSpeaking(false);
            setMood('idle');
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            setMood('idle');
          };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('Backend TTS fallback failed, using client TTS', err);
      }

      speak(text, pitch, rate, volume);
    },
    [hasTTS, hasUsableTTSVoice, speak, setIsSpeaking, setMood]
  );

  const startListening = useCallback(
    (onResult: (transcript: string, isFinal: boolean) => void) => {
      if (!hasSTT) return;
      onResultRef.current = onResult;
      shouldContinueListeningRef.current = true;
      lastInterimRef.current = '';
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }

      // Stop any ongoing speech or recognition before starting new STT
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setError(null);
      setCanRetrySTT(false);

      const SpeechRecognitionConstructor =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionConstructor) return;

      const recognition = new SpeechRecognitionConstructor();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      const armInactivityTimeout = () => {
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
          shouldContinueListeningRef.current = false;
          recognition.stop();
          setIsListening(false);
        }, 2000);
      };

      recognition.onstart = () => {
        setIsListening(true);
        setMood('idle');
        armInactivityTimeout();
      };

      recognition.onaudiostart = () => {
        setIsListening(true);
        armInactivityTimeout();
      };

      recognition.onaudioend = () => {
        setMood('idle');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final = event.results[i][0].transcript;
          else interim = event.results[i][0].transcript;
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        armInactivityTimeout();
        if (interim) {
          lastInterimRef.current = interim;
          silenceTimerRef.current = setTimeout(() => {
            if (!lastInterimRef.current.trim()) return;
            onResult(lastInterimRef.current, true);
            lastInterimRef.current = '';
          }, 1800);
        }
        if (final) {
          lastInterimRef.current = '';
        }
        onResult(final || interim, !!final);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);

        switch (event.error) {
          case 'not-allowed':
            setError('Microphone access was denied. Please check your browser settings.');
            setCanRetrySTT(false);
            setMood('angry');
            break;
          case 'no-speech':
            setError("I didn't hear anything.");
            setCanRetrySTT(true);
            setMood('sad');
            break;
          case 'network':
            setError('Network error. Speech recognition requires an internet connection.');
            setCanRetrySTT(true);
            setMood('sad');
            break;
          default:
            setError(`STT Error: ${event.error}`);
            setCanRetrySTT(true);
            setMood('idle');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
          inactivityTimerRef.current = null;
        }
        if (!shouldContinueListeningRef.current || !onResultRef.current) return;
        setTimeout(() => {
          if (shouldContinueListeningRef.current && onResultRef.current) {
            startListening(onResultRef.current);
          }
        }, 200);
      };

      recognition.start();
    },
    [hasSTT, setIsListening, setMood]
  );

  const retryListening = useCallback(() => {
    if (onResultRef.current) startListening(onResultRef.current);
  }, [startListening]);

  const stopTTS = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPaused(false);
    setIsSpeaking(false);
  }, [setIsSpeaking]);

  const stopSTT = useCallback(() => {
    shouldContinueListeningRef.current = false;
    lastInterimRef.current = '';
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (recognitionRef.current) recognitionRef.current.abort();
    setIsListening(false);
  }, [setIsListening]);

  // Function to stop all ongoing speech and recognition, and reset avatar state
  const stopAll = useCallback(() => {
    shouldContinueListeningRef.current = false;
    lastInterimRef.current = '';
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPaused(false);
    if (recognitionRef.current) recognitionRef.current.abort();
    reset();
  }, [reset]);

  return {
    canRetrySTT,
    error,
    hasSTT,
    hasTTS,
    hasUsableTTSVoice,
    isPaused,
    isSupported,
    pauseTTS,
    resumeTTS,
    retryListening,
    speakWithFallback,
    startListening,
    stopAll,
    stopSTT,
    stopTTS,
  };
};
