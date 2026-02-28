import { useCallback, useEffect, useRef, useState } from 'react';
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
    SpeechRecognition?: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition?: {
      new (): SpeechRecognition;
    };
  }
}

// Custom hook to manage Text-to-Speech and Speech-to-Text functionality
export const useVoice = () => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { setMood, setIsSpeaking, setIsListening, reset } = useAvatarStore();

  // Ref to hold the SpeechRecognition instance
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check for API support and clean up on unmount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasTTS = 'speechSynthesis' in window;
      const hasSTT = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
      setIsSupported(hasTTS && hasSTT);

      if (hasTTS) {
        window.speechSynthesis.getVoices();
      }
    }

    return () => {
      window.speechSynthesis.cancel();
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
      if (!isSupported) return;

      // Stop any ongoing speech or recognition before starting new TTS
      window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.abort();

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

      utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
        if (e.error !== 'interrupted') {
          console.error('TTS Error:', e);
          setError(`TTS Error: ${e.error}`);
        }
        setIsSpeaking(false);
        setMood('idle');
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSupported, setMood, setIsSpeaking, getBestVoice]
  );

  // Speech-to-Text function
  const startListening = useCallback(
    (onResult: (text: string) => void) => {
      if (!isSupported) return;

      // Stop any ongoing speech or recognition before starting new STT
      window.speechSynthesis.cancel();
      setError(null);

      const SpeechRecognitionConstructor =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionConstructor) return;

      const recognition = new SpeechRecognitionConstructor();
      recognitionRef.current = recognition;

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMood('idle');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setIsListening(false);

        switch (event.error) {
          case 'not-allowed':
            setError('Microphone access was denied. Please check your browser settings.');
            setMood('angry');
            break;
          case 'no-speech':
            setError("I didn't hear anything.");
            setMood('sad');
            break;
          case 'network':
            setError('Network error. Speech recognition requires an internet connection.');
            setMood('sad');
            break;
          case 'aborted':
            console.log('Speech recognition aborted.');
            break;
          default:
            setError(`STT Error: ${event.error}`);
            setMood('idle');
        }

        if (event.error !== 'aborted') {
          setTimeout(() => {
            setMood('idle');
            setError(null);
          }, 3000);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    },
    [isSupported, setIsListening, setMood]
  );

  // Function to stop all ongoing speech and recognition, and reset avatar state
  const stopAll = useCallback(() => {
    window.speechSynthesis.cancel();
    if (recognitionRef.current) recognitionRef.current.abort();
    reset();
  }, [reset]);

  return { error, isSupported, speak, startListening, stopAll };
};
