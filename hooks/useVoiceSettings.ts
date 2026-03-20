import { useEffect, useState } from 'react';

export type VoiceLanguageOverride = 'auto' | 'en' | 'ja' | 'zh';

export const useVoiceSettings = () => {
  const getSettings = () => {
    if (typeof window === 'undefined')
      return {
        languageOverride: 'auto' as VoiceLanguageOverride,
        pitch: 1.0,
        rate: 1.0,
        stt: true,
        styleWeight: 1.0,
        tts: true,
        volume: 1.0,
      };
    try {
      const stored = localStorage.getItem('voiceEnabled');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          languageOverride:
            parsed.languageOverride === 'en' ||
            parsed.languageOverride === 'ja' ||
            parsed.languageOverride === 'zh'
              ? parsed.languageOverride
              : 'auto',
          pitch: typeof parsed.pitch === 'number' ? parsed.pitch : 1.0,
          rate: typeof parsed.rate === 'number' ? parsed.rate : 1.0,
          stt: typeof parsed.stt === 'boolean' ? parsed.stt : true,
          styleWeight: typeof parsed.styleWeight === 'number' ? parsed.styleWeight : 1.0,
          tts: typeof parsed.tts === 'boolean' ? parsed.tts : true,
          volume: typeof parsed.volume === 'number' ? parsed.volume : 1.0,
        };
      }
    } catch {
      // Fallback on JSON parse error
    }
    return {
      languageOverride: 'auto' as VoiceLanguageOverride,
      pitch: 1.0,
      rate: 1.0,
      stt: true,
      styleWeight: 1.0,
      tts: true,
      volume: 1.0,
    };
  };

  const [sttEnabled, setSttEnabled] = useState<boolean>(() => getSettings().stt);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => getSettings().tts);
  const [languageOverride, setLanguageOverride] = useState<VoiceLanguageOverride>(
    () => getSettings().languageOverride
  );
  const [pitch, setPitch] = useState<number>(() => getSettings().pitch);
  const [rate, setRate] = useState<number>(() => getSettings().rate);
  const [volume, setVolume] = useState<number>(() => getSettings().volume);
  const [styleWeight, setStyleWeight] = useState<number>(() => getSettings().styleWeight);

  useEffect(() => {
    localStorage.setItem(
      'voiceEnabled',
      JSON.stringify({
        languageOverride,
        pitch,
        rate,
        stt: sttEnabled,
        styleWeight,
        tts: ttsEnabled,
        volume,
      })
    );
  }, [sttEnabled, ttsEnabled, languageOverride, pitch, rate, volume, styleWeight]);

  return {
    languageOverride,
    pitch,
    rate,
    setLanguageOverride,
    setPitch,
    setRate,
    setSttEnabled,
    setStyleWeight,
    setTtsEnabled,
    setVolume,
    sttEnabled,
    styleWeight,
    ttsEnabled,
    volume,
  };
};
