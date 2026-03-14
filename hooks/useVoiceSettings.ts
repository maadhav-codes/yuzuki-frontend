import { useEffect, useState } from 'react';

export const useVoiceSettings = () => {
  const getSettings = () => {
    if (typeof window === 'undefined') return { stt: true, tts: true };
    try {
      const stored = localStorage.getItem('voiceEnabled');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          stt: typeof parsed.stt === 'boolean' ? parsed.stt : true,
          tts: typeof parsed.tts === 'boolean' ? parsed.tts : true,
        };
      }
    } catch {
      // Fallback on JSON parse error
    }
    return { stt: true, tts: true };
  };

  const [sttEnabled, setSttEnabled] = useState<boolean>(
    () => getSettings().stt,
  );
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(
    () => getSettings().tts,
  );

  useEffect(() => {
    localStorage.setItem(
      'voiceEnabled',
      JSON.stringify({ stt: sttEnabled, tts: ttsEnabled }),
    );
  }, [sttEnabled, ttsEnabled]);

  return {
    setSttEnabled,
    setTtsEnabled,
    sttEnabled,
    ttsEnabled,
  };
};
