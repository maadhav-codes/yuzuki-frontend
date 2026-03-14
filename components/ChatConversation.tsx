'use client';

import { IconMicrophone, IconPlayerStopFilled, IconSend2, IconVolume2 } from '@tabler/icons-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className='flex h-full w-full items-center justify-center bg-slate-900/50 text-slate-400'>
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

interface ChatConversationProps {
  sttEnabled: boolean;
  ttsEnabled: boolean;
}

export default function ChatConversation({ sttEnabled, ttsEnabled }: ChatConversationProps) {
  const MOOD_DEBOUNCE_MS = 160;
  const MOOD_IDLE_RESET_MS = 8_000;

  const [input, setInput] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [hasCheckedMicPermission, setHasCheckedMicPermission] = useState(false);
  const [hasMicPermissionGranted, setHasMicPermissionGranted] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const sttBaseInputRef = useRef('');
  const spokenRef = useRef(new Set<number>());
  const pendingMoodRef = useRef<Mood | null>(null);
  const moodDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodIdleResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedMoodRef = useRef<Mood | null>(null);

  const [showPermDialog, setShowPermDialog] = useState(false);

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
    stopSTT,
    stopTTS,
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
    if (lastMsg && !lastMsg.is_user && !spokenRef.current.has(lastMsg.id) && hasTTS && ttsEnabled) {
      spokenRef.current.add(lastMsg.id);
      void speakWithFallback(lastMsg.content);
    }
  }, [messages, speakWithFallback, hasTTS, ttsEnabled]);

  useEffect(() => {
    if (!sttEnabled) stopSTT();
    if (!ttsEnabled) stopTTS();
  }, [sttEnabled, ttsEnabled, stopSTT, stopTTS]);

  useEffect(() => {
    if (!hasSTT) {
      console.warn('Speech-to-Text is unsupported in this browser.');
    }
  }, [hasSTT]);

  const scheduleIdleReset = useCallback(() => {
    if (moodIdleResetRef.current) clearTimeout(moodIdleResetRef.current);
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
      return 'Voice output unavailable. App is in text-only mode.';
    }
    if (!hasUsableTTSVoice) {
      return 'No TTS voice available. Responses remain in text-only mode.';
    }
    return null;
  }, [hasTTS, hasUsableTTSVoice]);

  const canSend = input.trim().length > 0 && !isReplying && wsState === 'open';

  const handleSend = useCallback(
    (msg?: string) => {
      const messageToSend = msg || input.trim();
      if (!messageToSend || isReplying) return;
      if (sendMessage(messageToSend)) {
        setInput('');
      }
    },
    [input, isReplying, sendMessage]
  );

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

  const startMicCapture = useCallback(() => {
    sttBaseInputRef.current = input.trim();
    setMicPermissionError(null);
    startListening((transcript, isFinal) => {
      setLiveTranscript(transcript);
      const baseInput = sttBaseInputRef.current;
      const preview = [baseInput, transcript.trim()].filter(Boolean).join(' ');
      setInput(preview);
      if (isFinal && transcript.trim()) {
        const finalMessage = [baseInput, transcript.trim()].filter(Boolean).join(' ');
        setLiveTranscript('');
        setInput('');
        sttBaseInputRef.current = '';
        handleSend(finalMessage);
      }
    });
  }, [handleSend, input, startListening]);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (hasCheckedMicPermission) return hasMicPermissionGranted;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicPermissionError('Microphone access is unavailable in this browser.');
      setHasCheckedMicPermission(true);
      setHasMicPermissionGranted(false);
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setMicPermissionError(null);
      setHasCheckedMicPermission(true);
      setHasMicPermissionGranted(true);
      return true;
    } catch {
      setMicPermissionError(
        'Microphone permission was denied. Please enable it in browser settings.'
      );
      setHasCheckedMicPermission(true);
      setHasMicPermissionGranted(false);
      return false;
    }
  }, [hasCheckedMicPermission, hasMicPermissionGranted]);

  const handleMicClick = async () => {
    if (!sttEnabled) return;
    if (isListening) {
      stopAll();
      setLiveTranscript('');
      sttBaseInputRef.current = '';
      return;
    }
    if (!hasCheckedMicPermission) {
      setShowPermDialog(true);
      return;
    }
    if (!hasMicPermissionGranted) {
      setMicPermissionError(
        'Microphone permission was denied. Please enable it in browser settings.'
      );
      return;
    }
    startMicCapture();
  };

  const handleConfirmMicPerm = async () => {
    setShowPermDialog(false);
    const granted = await requestMicPermission();
    if (granted) {
      startMicCapture();
    }
  };

  const connectionHint =
    wsState === 'reconnecting'
      ? `Offline - reconnecting in ${reconnectInSec ?? '?'}s`
      : wsState !== 'open'
        ? 'Offline - trying to connect...'
        : null;

  return (
    <div className='mx-auto grid h-full gap-4 lg:grid-cols-[1.1fr_1.3fr]'>
      <Card className='flex min-h-0 flex-col overflow-hidden rounded-2xl border-slate-800/60 bg-slate-900/40 shadow-xl backdrop-blur-md'>
        <CardHeader className='space-y-1.5 px-5 pb-4 pt-5'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-lg font-semibold text-slate-100'>Chat Window</CardTitle>
            <div className='flex gap-2'>
              <Badge
                className='border-slate-700 bg-slate-800/50 text-slate-300'
                variant={statusBadge.variant}
              >
                {statusBadge.text}
              </Badge>
              <Badge className='border-cyan-500/30 bg-cyan-500/10 text-cyan-200' variant='outline'>
                {mood}
              </Badge>
            </div>
          </div>
          <CardDescription className='text-xs text-slate-400'>
            Type or use your microphone to talk with the avatar.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5'>
          <Separator className='-mx-5 mb-2 w-[calc(100%+2.5rem)] bg-slate-800/60' />

          {connectionHint && (
            <p className='rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200'>
              {connectionHint}
            </p>
          )}
          {chatError && (
            <p className='rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200'>{chatError}</p>
          )}
          {ttsFallbackCopy && (
            <p className='rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200'>
              {ttsFallbackCopy}
            </p>
          )}
          {error && (
            <div className='flex flex-wrap items-center justify-between gap-2 rounded-lg bg-rose-500/10 px-3 py-2'>
              <p className='text-[11px] text-rose-200'>{error}</p>
              {canRetrySTT && (
                <Button
                  className='h-6 rounded bg-rose-500/20 px-2 text-[10px] font-medium text-rose-300 hover:bg-rose-500/30 hover:text-rose-100'
                  onClick={retryListening}
                  size='sm'
                  variant='ghost'
                >
                  Retry Mic
                </Button>
              )}
            </div>
          )}
          {micPermissionError && (
            <p className='rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-200'>
              {micPermissionError}
            </p>
          )}
          {sttEnabled && hasSTT && (
            <p className='rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200'>
              Tip: In noisy environments, speech recognition quality may degrade. Move to a quieter
              space for better results.
            </p>
          )}

          <ScrollArea
            className='min-h-0 flex-1 space-y-4 rounded-xl px-1'
            ref={messagesContainerRef}
          >
            <div className='flex flex-col gap-4 py-2'>
              {messages.length === 0 && !loadingMessages ? (
                <div className='mt-10 flex flex-col items-center justify-center text-center'>
                  <div className='mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/50 text-slate-400'>
                    <IconMicrophone className='h-5 w-5' />
                  </div>
                  <p className='text-sm text-slate-400'>No messages yet.</p>
                  <p className='mt-1 text-xs text-slate-500'>Say hello to begin.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    className={`flex w-full ${msg.is_user ? 'justify-end' : 'justify-start'}`}
                    key={msg.id}
                  >
                    <div
                      className={`group flex max-w-[85%] items-end gap-2 ${
                        msg.is_user ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <div
                        className={`relative rounded-2xl px-4 py-2.5 shadow-sm ${
                          msg.is_user
                            ? 'rounded-br-sm bg-cyan-600 text-white'
                            : 'rounded-bl-sm border border-slate-700/50 bg-slate-800/80 text-slate-100'
                        }`}
                      >
                        <p className='whitespace-pre-wrap text-[13px] leading-relaxed'>
                          {msg.content}
                        </p>

                        {!msg.is_user && hasTTS && (
                          <Button
                            aria-label={!ttsEnabled ? 'Play message (TTS disabled)' : 'Play message'}
                            className='absolute -bottom-3 -right-3 h-7 w-7 rounded-full border border-slate-700 bg-slate-900 text-slate-400 opacity-0 shadow-sm transition-all hover:bg-slate-800 hover:text-cyan-400 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50'
                            disabled={!ttsEnabled}
                            onClick={() => speakWithFallback(msg.content)}
                            size='icon'
                            title={!ttsEnabled ? 'TTS disabled' : 'Play message'}
                            variant='outline'
                          >
                            <IconVolume2 className='h-3.5 w-3.5' />
                          </Button>
                        )}

                        <p className='mt-1 text-[11px] opacity-70'>{formatTime(msg.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {liveTranscript && (
                <div className='flex w-full justify-end'>
                  <div className='max-w-[85%] rounded-2xl rounded-br-sm border border-cyan-500/30 bg-cyan-900/30 px-4 py-2.5 text-[13px] text-cyan-200'>
                    {liveTranscript}...
                    <div className='mt-2 h-1 w-8 animate-pulse rounded-full bg-cyan-500/50' />
                  </div>
                </div>
              )}

              {(loadingMessages || (isReplying && !hasFirstChunk)) && (
                <div className='flex w-full justify-start'>
                  <div className='max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-700/50 bg-slate-800/80 px-4 py-3.5'>
                    <div className='flex items-center gap-1.5'>
                      <span className='h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]' />
                      <span className='h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]' />
                      <span className='h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400' />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className='mt-2 flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/80 p-1.5 pl-4 shadow-sm focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/50'>
            <Input
              className='h-10 flex-1 border-0 bg-transparent px-0 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50'
              disabled={isReplying || wsState !== 'open'}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder='Type a message...'
              type='text'
              value={input}
            />

            {isReplying ? (
              <Button
                aria-label='Stop generation'
                className='h-9 w-9 shrink-0 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 hover:text-rose-300'
                onClick={() => stopGeneration()}
                size='icon'
                variant='ghost'
              >
                <IconPlayerStopFilled className='size-4' />
              </Button>
            ) : (
              <Button
                aria-label='Send message'
                className='h-9 w-9 shrink-0 rounded-full bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50'
                disabled={!canSend}
                onClick={() => handleSend()}
                size='icon'
              >
                <IconSend2 className='h-4 w-4' />
              </Button>
            )}

            <div className='mx-1 h-6 w-px bg-slate-700/60' />

            <Button
              aria-label={isListening ? 'Stop recording' : 'Start recording'}
              className={`h-9 w-9 shrink-0 rounded-full transition-colors ${
                isListening
                  ? 'bg-rose-500 text-white hover:bg-rose-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              disabled={!hasSTT || !sttEnabled}
              onClick={() => void handleMicClick()}
              size='icon'
              variant='secondary'
            >
              {isListening ? (
                <IconPlayerStopFilled className='h-4 w-4' />
              ) : (
                <IconMicrophone className='h-4 w-4' />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className='hidden min-h-0 flex-col overflow-hidden rounded-2xl border-slate-800/60 bg-slate-900/40 shadow-xl backdrop-blur-md lg:flex'>
        <CardContent className='relative flex h-full flex-col justify-end p-0'>
          <div className='absolute left-5 right-5 top-5 z-10 flex items-center justify-between'>
            <div className='space-y-1'>
              <h3 className='text-sm font-semibold text-slate-100 drop-shadow-md'>Avatar</h3>
              <p className='text-xs text-slate-300 drop-shadow'>Live2D driven representation</p>
            </div>
          </div>

          <div className='h-full w-full bg-linear-to-b from-transparent to-slate-950/60'>
            <AvatarView />
          </div>
        </CardContent>
      </Card>

      <AlertDialog onOpenChange={setShowPermDialog} open={showPermDialog}>
        <AlertDialogContent className='border-slate-900/80 bg-slate-900 p-4 text-slate-100 sm:rounded-2xl sm:max-w-lg'>
          <AlertDialogHeader className='flex flex-col gap-3 sm:text-left'>
            <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 sm:mx-0'>
              <IconMicrophone className='h-6 w-6' />
            </div>
            <div>
              <AlertDialogTitle className='text-xl font-semibold tracking-tight text-slate-50'>
                Enable Microphone
              </AlertDialogTitle>
              <AlertDialogDescription className='mt-2 text-sm leading-relaxed text-slate-400'>
                This app needs access to your microphone to transcribe text. Processing is secure
                and temporarily stored locally or via secure APIs.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className='mt-6 border-white/30 sm:space-x-3 bg-transparent'>
            <Button
              className='w-full rounded-lg text-slate-300 
              bg-slate-800/50 transition-colors hover:bg-slate-800/80 hover:text-slate-300 sm:w-auto'
              onClick={() => setShowPermDialog(false)}
              variant='ghost'
            >
              Cancel
            </Button>
            <Button
              className='w-full rounded-lg bg-cyan-600 text-white shadow-md shadow-cyan-900/20 transition-colors hover:bg-cyan-500 sm:w-auto'
              onClick={handleConfirmMicPerm}
            >
              Continue
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
