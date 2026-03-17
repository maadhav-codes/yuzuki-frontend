import { useEffect, useMemo, useRef, useState } from 'react';

interface UseLipSyncOptions {
  audioElement: HTMLAudioElement | null;
  isSpeaking: boolean;
  isPlaying: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const useLipSync = ({ audioElement, isSpeaking, isPlaying }: UseLipSyncOptions) => {
  const [mouthOpenY, setMouthOpenY] = useState(0.08);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameAtRef = useRef(0);
  const lastValueRef = useRef(0.08);
  const boundAudioRef = useRef<HTMLAudioElement | null>(null);
  const sampleBufferRef = useRef<Uint8Array | null>(null);

  const shouldUseFallbackInference = useMemo(
    () =>
      !audioElement || !isPlaying || typeof window === 'undefined' || !('AudioContext' in window),
    [audioElement, isPlaying]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const clearLoop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    if (!isSpeaking) {
      clearLoop();
      lastValueRef.current = 0.08;
      setMouthOpenY(0.08);
      return;
    }

    if (!shouldUseFallbackInference && audioElement) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new window.AudioContext();
        }

        if (audioContextRef.current.state === 'suspended') {
          void audioContextRef.current.resume();
        }

        if (!analyserRef.current) {
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.7;
          analyserRef.current = analyser;
        }

        if (!sourceRef.current || boundAudioRef.current !== audioElement) {
          sourceRef.current?.disconnect();
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
          boundAudioRef.current = audioElement;
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        }
      } catch {
        // Analyzer setup can fail for cross-origin audio or browser restrictions.
      }
    }

    const tick = (ts: number) => {
      rafRef.current = requestAnimationFrame(tick);

      if (ts - frameAtRef.current < 33) return;
      frameAtRef.current = ts;

      let next = 0.08;
      const analyser = analyserRef.current;

      if (!shouldUseFallbackInference && analyser) {
        if (!sampleBufferRef.current || sampleBufferRef.current.length !== analyser.fftSize) {
          sampleBufferRef.current = new Uint8Array(analyser.fftSize);
        }
        const data = sampleBufferRef.current;
        analyser.getByteTimeDomainData(data as Uint8Array<ArrayBuffer>);

        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const normalized = (data[i] - 128) / 128;
          sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / data.length);
        next = clamp(0.06 + rms * 3.2, 0.06, 1);
      } else {
        const phase = ts / 120;
        const inferred = 0.23 + (Math.sin(phase) * 0.18 + Math.sin(phase * 1.7) * 0.08);
        next = clamp(inferred, 0.08, 0.75);
      }

      const eased = lastValueRef.current * 0.65 + next * 0.35;
      lastValueRef.current = eased;
      setMouthOpenY(eased);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      clearLoop();
      sourceRef.current?.disconnect();
      sourceRef.current = null;
      boundAudioRef.current = null;
      analyserRef.current?.disconnect();
      analyserRef.current = null;
    };
  }, [audioElement, isSpeaking, shouldUseFallbackInference]);

  useEffect(
    () => () => {
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    },
    []
  );

  return { mouthOpenY };
};
