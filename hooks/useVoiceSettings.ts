import { useEffect, useState } from 'react';

export const useVoiceSettings = () => {
  const getSettings = () => {
    if (typeof window === 'undefined')
      return { pitch: 1.0, rate: 1.0, stt: true, tts: true, volume: 1.0 };
    try {
      const stored = localStorage.getItem('voiceEnabled');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          pitch: typeof parsed.pitch === 'number' ? parsed.pitch : 1.0,
          rate: typeof parsed.rate === 'number' ? parsed.rate : 1.0,
          stt: typeof parsed.stt === 'boolean' ? parsed.stt : true,
          tts: typeof parsed.tts === 'boolean' ? parsed.tts : true,
          volume: typeof parsed.volume === 'number' ? parsed.volume : 1.0,
        };
      }
    } catch {
      // Fallback on JSON parse error
    }
    return { pitch: 1.0, rate: 1.0, stt: true, tts: true, volume: 1.0 };
  };

  const [sttEnabled, setSttEnabled] = useState<boolean>(() => getSettings().stt);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => getSettings().tts);
  const [pitch, setPitch] = useState<number>(() => getSettings().pitch);
  const [rate, setRate] = useState<number>(() => getSettings().rate);
  const [volume, setVolume] = useState<number>(() => getSettings().volume);

  useEffect(() => {
    localStorage.setItem(
      'voiceEnabled',
      JSON.stringify({ pitch, rate, stt: sttEnabled, tts: ttsEnabled, volume })
    );
  }, [sttEnabled, ttsEnabled, pitch, rate, volume]);

  return {
    pitch,
    rate,
    setPitch,
    setRate,
    setSttEnabled,
    setTtsEnabled,
    setVolume,
    sttEnabled,
    ttsEnabled,
    volume,
  };
};
