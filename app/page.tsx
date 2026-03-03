'use client';

import { IconMicrophone, IconPlayerStopFilled, IconSend2 } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

const AvatarView = dynamic(() => import('@/components/AvatarView'), {
  loading: () => (
    <div className='flex h-full w-full items-center justify-center bg-slate-900 text-slate-400'>
      Loading Avatar...
    </div>
  ),
  ssr: false,
});

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useVoice } from '@/hooks/useVoice';
import { useAvatarStore } from '@/store/avatarStore';
import { useChatStore } from '@/store/chatStore';

export default function Home() {
  const [input, setInput] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    canRetrySTT,
    error,
    hasSTT,
    hasTTS,
    hasUsableTTSVoice,
    isSupported,
    retryListening,
    speak,
    startListening,
    stopAll,
  } = useVoice();
  const { isListening, isSpeaking, mood } = useAvatarStore();
  const { messages, addMessage } = useChatStore();
  const canSend = input.trim().length > 0 && !isReplying;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isReplying]);

  const statusBadge = useMemo(() => {
    if (!isSupported) return { text: 'Voice unsupported', variant: 'destructive' as const };
    if (isListening) return { text: 'Listening', variant: 'secondary' as const };
    if (isSpeaking) return { text: 'Speaking', variant: 'secondary' as const };
    return { text: 'Ready', variant: 'outline' as const };
  }, [isSupported, isListening, isSpeaking]);

  const ttsFallbackCopy = useMemo(() => {
    if (!hasTTS) {
      return 'Voice output is unavailable in this browser. The app is in text-only mode.';
    }
    if (!hasUsableTTSVoice) {
      return 'No TTS voice is currently available. Responses remain visible in chat (text-only mode).';
    }
    return null;
  }, [hasTTS, hasUsableTTSVoice]);

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

  const getAiResponse = (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed) return 'Please share a message and I will respond.';
    if (trimmed.endsWith('?')) return `Good question. Here is a direct take on "${trimmed}"`;
    return `I heard you: "${trimmed}". I can help you expand this into a clearer next action.`;
  };

  const handleSend = () => {
    const message = input.trim();
    if (!message || isReplying) return;

    addMessage({
      createdAt: Date.now(),
      id: crypto.randomUUID(),
      text: message,
      type: 'user',
    });
    setInput('');
    setIsReplying(true);

    const aiResponse = getAiResponse(message);

    setTimeout(() => {
      addMessage({
        createdAt: Date.now(),
        id: crypto.randomUUID(),
        text: aiResponse,
        type: 'ai',
      });
      setIsReplying(false);
      speak(aiResponse);
    }, 500);
  };

  const handleMicClick = () => {
    if (isListening || isSpeaking) {
      stopAll();
      return;
    }

    startListening((transcript) => {
      setInput(transcript);
    });
  };

  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_top_left,#1e293b_0%,#020617_40%,#020617_100%)] p-4 text-slate-100 md:p-6'>
      <div className='mx-auto grid h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:h-[calc(100vh-3rem)] lg:grid-cols-[1.05fr_1.35fr]'>
        <Card className='flex min-h-0 flex-col border-slate-700/60 bg-slate-900/70 shadow-2xl shadow-cyan-950/20 backdrop-blur'>
          <CardHeader className='space-y-3 pb-3'>
            <div className='space-y-1'>
              <CardTitle className='text-xl tracking-tight text-slate-50'>Voice Chat</CardTitle>
              <CardDescription className='text-slate-300'>
                Type or use your microphone to talk with the avatar.
              </CardDescription>
            </div>
            <div className='h-px w-full bg-linear-to-r from-cyan-400/60 via-sky-400/20 to-transparent' />
          </CardHeader>
          <CardContent className='flex min-h-0 flex-1 flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <Badge
                className='border-slate-600 bg-slate-800/70 text-slate-100'
                variant={statusBadge.variant}
              >
                {statusBadge.text}
              </Badge>
              <Badge className='border-cyan-400/30 bg-cyan-400/10 text-cyan-100' variant='outline'>
                Mood: {mood}
              </Badge>
            </div>

            <Separator className='bg-slate-700/70' />

            {ttsFallbackCopy ? (
              <p className='rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100'>
                {ttsFallbackCopy}
              </p>
            ) : null}

            {!hasSTT ? (
              <p className='rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100'>
                Microphone input is unavailable in this browser. You can still type messages.
              </p>
            ) : null}

            <p className='rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300'>
              Microphone notice: audio is only used to transcribe your speech after you tap the mic
              button. The app does not start recording automatically.
            </p>

            <div className='flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-700/80 bg-linear-to-b from-slate-900/75 to-slate-950/75 p-3.5 shadow-inner shadow-black/30'>
              {messages.length === 0 ? (
                <p className='rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-3 py-4 text-center text-sm text-slate-400'>
                  No messages yet. Ask something or tap the mic to begin.
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    className={`max-w-[88%] rounded-2xl border px-3.5 py-2.5 shadow ${
                      msg.type === 'user'
                        ? 'ml-auto border-sky-400/60 bg-sky-500 text-white shadow-sky-900/40'
                        : 'border-slate-700 bg-slate-800/90 text-slate-100 shadow-black/25'
                    }`}
                    key={msg.id}
                  >
                    <p className='whitespace-pre-wrap text-sm leading-relaxed'>{msg.text}</p>
                    <p className='mt-1 text-[11px] opacity-70'>{formatTime(msg.createdAt)}</p>
                  </div>
                ))
              )}
              {isReplying && (
                <div className='max-w-[88%] rounded-2xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-sm text-slate-300 shadow shadow-black/25'>
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error ? (
              <div className='flex flex-wrap items-center gap-2'>
                <p className='text-xs text-rose-400'>{error}</p>
                {canRetrySTT ? (
                  <Button
                    className='h-7 rounded-md border-slate-600 bg-slate-800 px-2 text-xs text-slate-100 hover:bg-slate-700'
                    onClick={retryListening}
                    size='sm'
                    type='button'
                    variant='secondary'
                  >
                    Retry mic
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardContent>
          <CardFooter className='border-t border-slate-700/80 bg-slate-900/50 pt-4'>
            <div className='flex w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-2 shadow-lg shadow-black/25'>
              <Input
                className='h-12 flex-1 border-slate-700/70 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-400/80'
                disabled={isReplying}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder='Type your message...'
                type='text'
                value={input}
              />
              <Button
                aria-label='Send message'
                className='h-12 rounded-xl bg-linear-to-r from-cyan-400 to-sky-500 px-5 font-semibold text-slate-950 shadow-md shadow-cyan-900/40 hover:from-cyan-300 hover:to-sky-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-300'
                disabled={!canSend}
                onClick={handleSend}
                title='Send message'
              >
                <IconSend2 aria-hidden='true' className='size-4' />
              </Button>
              <Button
                aria-label={isListening || isSpeaking ? 'Stop voice session' : 'Start listening'}
                className={`h-12 min-w-20 rounded-xl border px-4 font-semibold text-white shadow-md transition-colors ${
                  isListening || isSpeaking
                    ? 'border-rose-300/60 bg-rose-500 hover:bg-rose-400'
                    : 'border-slate-600 bg-slate-800 hover:bg-slate-700'
                }`}
                disabled={!hasSTT}
                onClick={handleMicClick}
                title={isListening || isSpeaking ? 'Stop voice session' : 'Start listening'}
                variant='secondary'
              >
                {isListening || isSpeaking ? (
                  <IconPlayerStopFilled aria-hidden='true' className='size-4' />
                ) : (
                  <IconMicrophone aria-hidden='true' className='size-4' />
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>

        <Card className='flex min-h-0 flex-col border-slate-700/60 bg-slate-900/70 shadow-2xl shadow-cyan-950/20 backdrop-blur'>
          <CardHeader className='space-y-3 pb-3'>
            <div className='space-y-1'>
              <CardTitle className='text-xl tracking-tight text-slate-50'>Avatar</CardTitle>
              <CardDescription className='text-slate-300'>
                Live2D model driven by voice state and mood.
              </CardDescription>
            </div>
            <div className='h-px w-full bg-linear-to-r from-cyan-400/60 via-sky-400/20 to-transparent' />
          </CardHeader>
          <CardContent className='relative min-h-0 flex-1 overflow-hidden rounded-b-xl border-t border-slate-700/70 p-0'>
            <div className='h-full min-h-125 bg-linear-to-b from-slate-800/40 to-slate-950/40'>
              <AvatarView />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
