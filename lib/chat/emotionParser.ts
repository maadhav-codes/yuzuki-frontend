export type AvatarMood = 'idle' | 'happy' | 'sad' | 'angry' | 'talking';

export function mapToMood(value: string): AvatarMood {
  const normalized = value.toLowerCase();

  if (
    normalized.includes('happy') ||
    normalized.includes('great') ||
    normalized.includes('joke') ||
    normalized.includes('lol') ||
    normalized.includes('excited') ||
    normalized.includes('joy')
  ) {
    return 'happy';
  }

  if (
    normalized.includes('sad') ||
    normalized.includes('sorry') ||
    normalized.includes('bad') ||
    normalized.includes('upset') ||
    normalized.includes('unhappy')
  ) {
    return 'sad';
  }

  if (
    normalized.includes('angry') ||
    normalized.includes('mad') ||
    normalized.includes('annoyed') ||
    normalized.includes('furious') ||
    normalized.includes('frustrated')
  ) {
    return 'angry';
  }

  if (
    normalized.includes('talking') ||
    normalized.includes('speaking') ||
    normalized.includes('explain') ||
    normalized.includes('answer')
  ) {
    return 'talking';
  }

  return 'idle';
}

export function parseEmotionAndContent(rawText: string): { mood: AvatarMood; content: string } {
  if (rawText.startsWith('EMOTION:')) {
    const [emotionLine, ...rest] = rawText.split('\n\n');
    const emotionValue = emotionLine.replace('EMOTION:', '').trim();
    return {
      content: rest.join('\n\n'),
      mood: mapToMood(emotionValue),
    };
  }

  return {
    content: rawText,
    mood: mapToMood(rawText),
  };
}
