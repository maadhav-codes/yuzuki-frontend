'use client';

import { IconMicrophone, IconPlayerStopFilled, IconSend2, IconVolume2 } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useVoice } from '@/hooks/useVoice';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ApiError, api } from '@/lib/api';
import type { Mood } from '@/store/avatarStore';
import { useAvatarStore } from '@/store/avatarStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useLoadingStore } from '@/store/useLoadingStore';
import { useUserStore } from '@/store/useUserStore';

const AvatarView = dynamic(() => import('@/components/AvatarView'), {
  loading: () => (
    <div className='flex h-full w-full items-center justify-center bg-slate-900 text-slate-400'>
      Loading Avatar...
    </div>
  ),
  ssr: false,
});

const formatTime = (timestamp: number | string) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export default function ChatConversation() {
  const MOOD_DEBOUNCE_MS = 160;
  const MOOD_IDLE_RESET_MS = 8_000;

  const [input, setInput] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const spokenRef = useRef(new Set<number>());
  const pendingMoodRef = useRef<Mood | null>(null);
  const moodDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodIdleResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedMoodRef = useRef<Mood | null>(null);

  const {
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
  } = useVoice();

  const { isListening, isSpeaking, mood, setMood } = useAvatarStore();
  lastAppliedMoodRef.current = mood;
  const user = useUserStore((state) => state.user);
  const { signOut } = useAuthStore();
  const setChatLoading = useLoadingStore((state) => state.setChatLoading);
  const {
    chatError,
    hasFirstChunk,
    isReplying,
    loadingMessages,
    messages,
    reconnectInSec,
    resetChatState,
    sessionId,
    setLoadingMessages,
    setMessages,
    setSessionId,
    wsState,
  } = useChatStore();
  const router = useRouter();

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && !lastMsg.is_user && !spokenRef.current.has(lastMsg.id) && hasTTS) {
      spokenRef.current.add(lastMsg.id);
      void speakWithFallback(lastMsg.content);
    }
  }, [messages, speakWithFallback, hasTTS]);

  const scheduleIdleReset = useCallback(() => {
    if (moodIdleResetRef.current) {
      clearTimeout(moodIdleResetRef.current);
    }

    moodIdleResetRef.current = setTimeout(() => {
      pendingMoodRef.current = null;
      if (lastAppliedMoodRef.current === 'idle') return;
      setMood('idle');
      lastAppliedMoodRef.current = 'idle';
    }, MOOD_IDLE_RESET_MS);
  }, [setMood]);

  const applyImmediateMood = useCallback(
    (nextMood: Mood) => {
      if (moodDebounceRef.current) {
        clearTimeout(moodDebounceRef.current);
        moodDebounceRef.current = null;
      }

      pendingMoodRef.current = null;

      if (nextMood === 'idle') {
        if (moodIdleResetRef.current) {
          clearTimeout(moodIdleResetRef.current);
          moodIdleResetRef.current = null;
        }
      } else {
        scheduleIdleReset();
      }

      if (lastAppliedMoodRef.current === nextMood) {
        return;
      }

      setMood(nextMood);
      lastAppliedMoodRef.current = nextMood;
    },
    [scheduleIdleReset, setMood]
  );

  const queueMoodUpdate = useCallback(
    (nextMood: Mood) => {
      if (nextMood === pendingMoodRef.current || nextMood === lastAppliedMoodRef.current) {
        if (nextMood !== 'idle') {
          scheduleIdleReset();
        }
        return;
      }

      pendingMoodRef.current = nextMood;

      if (moodDebounceRef.current) {
        clearTimeout(moodDebounceRef.current);
      }

      moodDebounceRef.current = setTimeout(() => {
        const moodToApply = pendingMoodRef.current;
        pendingMoodRef.current = null;
        moodDebounceRef.current = null;
        if (!moodToApply || moodToApply === lastAppliedMoodRef.current) return;
        setMood(moodToApply);
        lastAppliedMoodRef.current = moodToApply;
        if (moodToApply === 'idle') {
          if (moodIdleResetRef.current) {
            clearTimeout(moodIdleResetRef.current);
            moodIdleResetRef.current = null;
          }
          return;
        }
        scheduleIdleReset();
      }, MOOD_DEBOUNCE_MS);
    },
    [scheduleIdleReset, setMood]
  );

  const handleAuthFailure = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // Ignore sign out errors - we want to redirect to login regardless
    } finally {
      router.replace('/login');
    }
  }, [router, signOut]);

  const { closeSocket, reconcileFetchedMessages, sendMessage, stopGeneration } = useWebSocket({
    applyImmediateMood,
    onAuthFailure: handleAuthFailure,
    queueMoodUpdate,
    scheduleIdleReset,
    sessionId,
    userId: user?.id,
  });

  const fetchMessages = useCallback(async () => {
    if (!user || sessionId === null) return;
    try {
      setLoadingMessages(true);
      setChatLoading(true);
      const data = await api.getMessages(sessionId, 10);
      setMessages(reconcileFetchedMessages(data));
    } catch (err) {
      if (isAuthError(err)) {
        await handleAuthFailure();
        return;
      }
      console.error(err);
    } finally {
      setLoadingMessages(false);
      setChatLoading(false);
    }
  }, [
    user,
    sessionId,
    handleAuthFailure,
    reconcileFetchedMessages,
    setLoadingMessages,
    setChatLoading,
    setMessages,
  ]);

  useEffect(() => {
    return () => {
      if (moodDebounceRef.current) {
        clearTimeout(moodDebounceRef.current);
        moodDebounceRef.current = null;
        pendingMoodRef.current = null;
      }
      if (moodIdleResetRef.current) {
        clearTimeout(moodIdleResetRef.current);
        moodIdleResetRef.current = null;
      }
      closeSocket();
      resetChatState();
      setChatLoading(false);
    };
  }, [closeSocket, resetChatState, setChatLoading]);

  useEffect(() => {
    if (!user) {
      resetChatState();
      closeSocket();
      return;
    }

    const loadSession = async () => {
      try {
        setLoadingMessages(true);
        setChatLoading(true);
        const session = await api.getCurrentSession();
        setSessionId(session.id);
      } catch (err) {
        if (isAuthError(err)) {
          await handleAuthFailure();
        } else {
          console.error(err);
        }
      } finally {
        setLoadingMessages(false);
        setChatLoading(false);
      }
    };

    loadSession();
  }, [
    user,
    handleAuthFailure,
    closeSocket,
    resetChatState,
    setLoadingMessages,
    setChatLoading,
    setSessionId,
  ]);

  useEffect(() => {
    if (sessionId !== null) {
      fetchMessages();
    }
  }, [sessionId, fetchMessages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  });

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

  const canSend = input.trim().length > 0 && !isReplying && wsState === 'open';

  const handleSend = (msg?: string) => {
    const messageToSend = msg || input.trim();
    if (!messageToSend || isReplying) return;
    if (sendMessage(messageToSend)) {
      setInput('');
    }
  };

  const _handleDelete = async (id: number) => {
    try {
      await api.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      if (isAuthError(err)) {
        await handleAuthFailure();
        return;
      }
      console.error(err);
    }
  };

  const handleMicClick = () => {
    if (isListening || isSpeaking) {
      stopAll();
      setLiveTranscript('');
      return;
    }
    startListening((transcript, isFinal) => {
      setLiveTranscript(transcript);
      if (isFinal && transcript.trim()) {
        setLiveTranscript('');
        handleSend(transcript);
      }
    });
  };

  const handleStopGeneration = () => stopGeneration();

  const connectionHint =
    wsState === 'reconnecting'
      ? `Offline - reconnecting in ${reconnectInSec ?? '?'}s`
      : wsState !== 'open'
        ? 'Offline - trying to connect...'
        : null;

  return (
    <main className='h-full p-2 text-slate-100 md:p-4'>
      <div className='mx-auto grid h-full max-w-7xl gap-4 lg:grid-cols-[1.05fr_1.35fr]'>
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

            {connectionHint ? (
              <p className='rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100'>
                {connectionHint}
              </p>
            ) : null}

            {chatError ? (
              <p className='rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100'>
                {chatError}
              </p>
            ) : null}

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

            <ScrollArea
              className='min-h-0 flex-1 space-y-2 rounded-xl border border-slate-700/80 bg-linear-to-b from-slate-900/75 to-slate-950/75 p-3.5 shadow-inner shadow-black/30'
              ref={messagesContainerRef}
            >
              {messages.length === 0 && !loadingMessages ? (
                <p className='rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-3 py-4 text-center text-sm text-slate-400'>
                  No messages yet. Ask something or tap the mic to begin.
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    className={`flex w-full ${msg.is_user ? 'justify-end' : 'justify-start'}`}
                    key={msg.id}
                  >
                    <div
                      className={`flex max-w-[88%] items-end gap-2 ${msg.is_user ? 'flex-row-reverse' : ''}`}
                    >
                      {!msg.is_user ? (
                        <div className='mb-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/15 text-[10px] font-semibold text-cyan-200'>
                          AI
                        </div>
                      ) : null}
                      <div
                        className={`rounded-2xl border px-3.5 py-2.5 shadow relative ${
                          msg.is_user
                            ? 'border-sky-400/60 bg-sky-500 text-white shadow-sky-900/40'
                            : 'border-slate-700 bg-slate-800/90 text-slate-100 shadow-black/25'
                        }`}
                      >
                        <p className='whitespace-pre-wrap text-sm leading-relaxed'>{msg.content}</p>

                        {!msg.is_user && (
                          <button
                            aria-label='Speak response'
                            className='absolute -bottom-2 -right-2 rounded-full bg-slate-800 p-1.5 text-cyan-400 hover:bg-cyan-950 transition-colors shadow-md'
                            onClick={() => speakWithFallback(msg.content)}
                            title='Speak this message'
                            type='button'
                          >
                            <IconVolume2 className='size-4' />
                          </button>
                        )}

                        <p className='mt-1 text-[11px] opacity-70'>{formatTime(msg.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {liveTranscript && (
                <div className='max-w-[88%] rounded-2xl border border-dashed border-cyan-400 bg-cyan-950/70 px-3.5 py-2.5 text-sm text-cyan-300'>
                  <span className='font-medium'>You:</span> {liveTranscript}...
                  <div className='mt-2 h-1 w-8 animate-pulse rounded bg-cyan-400' />
                </div>
              )}

              {loadingMessages && (
                <div className='flex w-full justify-start'>
                  <div className='flex max-w-[88%] items-end gap-2'>
                    <div className='mb-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/15 text-[10px] font-semibold text-cyan-200'>
                      AI
                    </div>
                    <div className='rounded-2xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-sm text-slate-300 shadow shadow-black/25'>
                      <div className='flex items-center gap-1.5'>
                        <span className='size-2 rounded-full animate-bounce bg-slate-300 [animation-delay:-0.3s]' />
                        <span className='size-2 rounded-full animate-bounce bg-slate-300 [animation-delay:-0.15s]' />
                        <span className='size-2 rounded-full animate-bounce bg-slate-300' />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {isReplying && !hasFirstChunk && (
                <div className='flex w-full justify-start'>
                  <div className='flex max-w-[88%] items-end gap-2'>
                    <div className='mb-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/15 text-[10px] font-semibold text-cyan-200'>
                      AI
                    </div>
                    <div className='rounded-2xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-sm text-slate-300 shadow shadow-black/25'>
                      <div className='flex items-center gap-1.5'>
                        <span className='size-2 rounded-full animate-bounce bg-slate-300 [animation-delay:-0.3s]' />
                        <span className='size-2 rounded-full animate-bounce bg-slate-300 [animation-delay:-0.15s]' />
                        <span className='size-2 rounded-full animate-bounce bg-slate-300' />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>

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
          <CardFooter className='shrink-0 border-t border-slate-700/80 bg-slate-900/50 pt-4'>
            <div className='flex w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-2 shadow-lg shadow-black/25'>
              <Input
                className='h-12 flex-1 border-slate-700/70 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-400/80'
                disabled={isReplying || wsState !== 'open'}
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
                onClick={() => void handleSend()}
                title='Send message'
              >
                <IconSend2 aria-hidden='true' className='size-4' />
              </Button>
              <Button
                aria-label='Stop generation'
                className='h-12 rounded-xl border border-rose-300/60 bg-rose-500 px-4 font-semibold text-white shadow-md hover:bg-rose-400 disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-400'
                disabled={!isReplying || wsState !== 'open'}
                onClick={handleStopGeneration}
                title='Stop generation'
                type='button'
                variant='secondary'
              >
                <IconPlayerStopFilled aria-hidden='true' className='size-4' />
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
