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

  // Support + voices check
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ttsSupported = 'speechSynthesis' in window;
    const sttSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    setHasTTS(ttsSupported);
    setHasSTT(sttSupported);
    setIsSupported(ttsSupported || sttSupported);

    if (ttsSupported) {
      const updateVoices = () => {
        setHasUsableTTSVoice(window.speechSynthesis.getVoices().length > 0);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) recognitionRef.current.abort();
      reset();
    };
  }, [reset]);

  // Function to select the best available voice for TTS
  const getBestVoice = useCallback((): SpeechSynthesisVoice | undefined => {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang.includes('en-US') && v.name.includes('Google')) ||
      voices.find((v) => v.lang.includes('en-US')) ||
      voices[0]
    );
  }, []);

  // Text-to-Speech function
  const speak = useCallback(
    (text: string) => {
      if (!hasTTS) return;

      // Stop any ongoing speech or recognition before starting new TTS
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = getBestVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setMood('talking');
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setMood('idle');
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setMood('idle');
      };

      window.speechSynthesis.speak(utterance);
    },
    [hasTTS, getBestVoice, setIsSpeaking, setMood]
  );

  const speakWithFallback = useCallback(
    async (text: string) => {
      if (!hasTTS) return;

      if (hasUsableTTSVoice) {
        speak(text);
        return;
      }

      try {
        const data = await api.generateTTS(text);
        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          audio.onplay = () => {
            setIsSpeaking(true);
            setMood('talking');
          };
          audio.onended = () => {
            setIsSpeaking(false);
            setMood('idle');
          };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('Backend TTS fallback failed, using client TTS', err);
      }

      speak(text);
    },
    [hasTTS, hasUsableTTSVoice, speak, setIsSpeaking, setMood]
  );

  const startListening = useCallback(
    (onResult: (transcript: string, isFinal: boolean) => void) => {
      if (!hasSTT) return;
      onResultRef.current = onResult;

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

      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMood('idle');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final = event.results[i][0].transcript;
          else interim = event.results[i][0].transcript;
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

      recognition.onend = () => setIsListening(false);
      recognition.start();
    },
    [hasSTT, setIsListening, setMood]
  );

  const retryListening = useCallback(() => {
    if (onResultRef.current) startListening(onResultRef.current);
  }, [startListening]);

  // Function to stop all ongoing speech and recognition, and reset avatar state
  const stopAll = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) recognitionRef.current.abort();
    reset();
  }, [reset]);

  return {
    canRetrySTT,
    error,
    hasSTT,
    hasTTS,
    hasUsableTTSVoice,
    isSupported,
    retryListening,
    speakWithFallback,
    startListening,
    stopAll,
  };
};
