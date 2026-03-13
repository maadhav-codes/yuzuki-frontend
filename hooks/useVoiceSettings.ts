import { useEffect, useState } from 'react';

export const useVoiceSettings = () => {
  const [sttEnabled, setSttEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('voiceSttEnabled');
    return stored ? stored === 'true' : true;
  });

  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('voiceTtsEnabled');
    return stored ? stored === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('voiceSttEnabled', String(sttEnabled));
  }, [sttEnabled]);

  useEffect(() => {
    localStorage.setItem('voiceTtsEnabled', String(ttsEnabled));
  }, [ttsEnabled]);

  return {
    setSttEnabled,
    setTtsEnabled,
    sttEnabled,
    ttsEnabled,
  };
};
