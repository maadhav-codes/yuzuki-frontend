'use client';

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

  const { speak, startListening, isSupported, error, stopAll } = useVoice();
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
    <main className='min-h-screen bg-slate-950 p-4 text-slate-100 md:p-6'>
      <div className='mx-auto grid h-[calc(100vh-2rem)] max-w-7xl gap-4 md:h-[calc(100vh-3rem)] md:grid-cols-[1.1fr_1.4fr]'>
        <Card className='flex min-h-0'>
          <CardHeader className='pb-2'>
            <CardTitle>Voice Chat</CardTitle>
            <CardDescription>Type or use your microphone to talk with the avatar.</CardDescription>
          </CardHeader>
          <CardContent className='flex min-h-0 flex-1 flex-col gap-3'>
            <div className='flex items-center justify-between'>
              <Badge variant={statusBadge.variant}>{statusBadge.text}</Badge>
              <Badge variant='outline'>Mood: {mood}</Badge>
            </div>

            <Separator />

            <div className='flex-1 space-y-2 overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/60 p-3'>
              {messages.length === 0 ? (
                <p className='text-sm text-slate-400'>
                  No messages yet. Ask something or tap the mic to begin.
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      msg.type === 'user'
                        ? 'ml-auto bg-sky-600 text-white'
                        : 'bg-slate-800 text-slate-100'
                    }`}
                    key={msg.id}
                  >
                    <p className='whitespace-pre-wrap text-sm leading-relaxed'>{msg.text}</p>
                    <p className='mt-1 text-[11px] opacity-70'>{formatTime(msg.createdAt)}</p>
                  </div>
                ))
              )}
              {isReplying && (
                <div className='max-w-[85%] rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300'>
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error ? <p className='text-xs text-rose-400'>{error}</p> : null}
          </CardContent>
          <CardFooter className='flex items-center gap-2'>
            <Input
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
            <Button disabled={!canSend} onClick={handleSend}>
              Send
            </Button>
            <Button
              onClick={handleMicClick}
              title={isListening || isSpeaking ? 'Stop voice session' : 'Start listening'}
              variant={isListening ? 'destructive' : 'secondary'}
            >
              {isListening || isSpeaking ? 'Stop' : 'Mic'}
            </Button>
          </CardFooter>
        </Card>

        <Card className='flex min-h-0 flex-col'>
          <CardHeader className='pb-2'>
            <CardTitle>Avatar</CardTitle>
            <CardDescription>Live2D model driven by voice state and mood.</CardDescription>
          </CardHeader>
          <CardContent className='relative flex-1 min-h-0 p-0 overflow-hidden'>
            <div className='h-full min-h-125'>
              <AvatarView />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
