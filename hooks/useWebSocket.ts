import { useCallback, useEffect, useRef } from 'react';

import { ApiError } from '@/lib/api';
import { parseEmotionAndContent } from '@/lib/chat/emotionParser';
import type { Mood } from '@/store/avatarStore';
import { useChatStore } from '@/store/useChatStore';
import type { MessageRead } from '@/types/api';
import { supabase } from '@/utils/supabase/client';

const HEARTBEAT_MS = 35_000;
const RECONNECT_CAP_MS = 30_000;

interface PendingOutgoingMessage {
  content: string;
  optimisticId: number;
  payload: string;
  timestamp: string;
}

interface UseWebSocketParams {
  sessionId: number | null;
  userId?: string;
  onAuthFailure: () => Promise<void>;
  applyImmediateMood: (mood: Mood) => void;
  queueMoodUpdate: (mood: Mood) => void;
  scheduleIdleReset: () => void;
}

function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function useWebSocket({
  sessionId,
  userId,
  onAuthFailure,
  applyImmediateMood,
  queueMoodUpdate,
  scheduleIdleReset,
}: UseWebSocketParams) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const assistantMessageIdRef = useRef<number | null>(null);
  const unsentQueueRef = useRef<PendingOutgoingMessage[]>([]);
  const localIdRef = useRef(-1);
  const unmountedRef = useRef(false);
  const reconnectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const connectWebSocketRef = useRef<(activeSessionId: number, isReconnect?: boolean) => void>(
    () => {}
  );

  const {
    decrementReconnectInSec,
    setChatError,
    setHasFirstChunk,
    setIsReplying,
    setMessages,
    setReconnectInSec,
    setWsState,
  } = useChatStore();

  const clearReconnectTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (reconnectCountdownRef.current) {
      clearInterval(reconnectCountdownRef.current);
      reconnectCountdownRef.current = null;
    }
    setReconnectInSec(null);
  }, [setReconnectInSec]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    stopHeartbeat();
    clearReconnectTimers();
    if (wsRef.current) {
      shouldReconnectRef.current = false;
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
  }, [clearReconnectTimers, stopHeartbeat]);

  const getWebSocketUrl = useCallback(async (activeSessionId: number) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new ApiError('Not authenticated', 401);
    }

    const backend = process.env.NEXT_PUBLIC_BACKEND_URL;
    const wsBase = backend?.trim().length
      ? backend
          .replace(/^http:/i, 'ws:')
          .replace(/^https:/i, 'wss:')
          .replace(/\/+$/, '')
      : `${window.location.origin.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')}/backend`;
    const wsPath = wsBase.endsWith('/api/v1') ? '/ws/chat' : '/api/v1/ws/chat';
    const url = new URL(`${wsBase}${wsPath}`);
    url.searchParams.set('conversation_id', String(activeSessionId));
    url.searchParams.set('token', token);
    return url.toString();
  }, []);

  const scheduleReconnect = useCallback(
    (activeSessionId: number) => {
      if (unmountedRef.current) return;

      const attempt = reconnectAttemptRef.current;
      const baseDelay = Math.min(2 ** attempt * 1000, RECONNECT_CAP_MS);
      const jitterMs = Math.floor(Math.random() * 1000);
      const totalDelay = baseDelay + jitterMs;
      reconnectAttemptRef.current += 1;
      reconnectingRef.current = true;
      setWsState('reconnecting');
      setReconnectInSec(Math.ceil(totalDelay / 1000));

      clearReconnectTimers();
      reconnectCountdownRef.current = setInterval(() => {
        decrementReconnectInSec();
      }, 1000);

      reconnectTimeoutRef.current = setTimeout(() => {
        clearReconnectTimers();
        connectWebSocketRef.current(activeSessionId, true);
      }, totalDelay);
    },
    [clearReconnectTimers, decrementReconnectInSec, setReconnectInSec, setWsState]
  );

  const connectWebSocket = useCallback(
    async (activeSessionId: number, isReconnect = false) => {
      if (unmountedRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

      setWsState(isReconnect ? 'reconnecting' : 'connecting');

      try {
        const wsUrl = await getWebSocketUrl(activeSessionId);
        const ws = new WebSocket(wsUrl);
        shouldReconnectRef.current = true;
        wsRef.current = ws;

        ws.onopen = async () => {
          reconnectAttemptRef.current = 0;
          reconnectingRef.current = false;
          clearReconnectTimers();
          setWsState('open');
          setChatError(null);
          setReconnectInSec(null);

          stopHeartbeat();
          heartbeatRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, HEARTBEAT_MS);

          if (unsentQueueRef.current.length > 0) {
            const queued = [...unsentQueueRef.current];
            for (const queuedMessage of queued) {
              ws.send(queuedMessage.payload);
            }
          }
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as {
              type?: string;
              content?: string;
              delta?: string;
              message?: string;
              error?: string;
              message_id?: number;
            };
            const type = payload.type ?? '';

            if (type === 'chunk') {
              const chunk = payload.content ?? payload.delta ?? payload.message ?? '';
              if (!chunk) return;
              const { mood: parsedMood, content } = parseEmotionAndContent(chunk);
              queueMoodUpdate(parsedMood);
              if (!content) return;

              setHasFirstChunk(true);
              setIsReplying(true);

              setMessages((prev) => {
                const assistantId = assistantMessageIdRef.current;
                if (assistantId === null) {
                  const createdId = localIdRef.current;
                  localIdRef.current -= 1;
                  assistantMessageIdRef.current = createdId;
                  return [
                    ...prev,
                    {
                      chat_session_id: activeSessionId,
                      content,
                      id: createdId,
                      is_user: false,
                      owner_id: userId ?? '',
                      timestamp: new Date().toISOString(),
                    },
                  ];
                }

                return prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: `${msg.content}${content}` } : msg
                );
              });
              return;
            }

            if (type === 'done' || type === 'complete') {
              const realId = payload.message_id;
              if (realId && assistantMessageIdRef.current !== null) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageIdRef.current ? { ...msg, id: realId } : msg
                  )
                );
              }
              assistantMessageIdRef.current = null;
              setIsReplying(false);
              setHasFirstChunk(false);
              scheduleIdleReset();
              return;
            }

            if (type === 'cancelled') {
              assistantMessageIdRef.current = null;
              setIsReplying(false);
              setHasFirstChunk(false);
              applyImmediateMood('idle');
              return;
            }

            if (type === 'error') {
              assistantMessageIdRef.current = null;
              setIsReplying(false);
              setHasFirstChunk(false);
              setChatError(payload.error || payload.message || 'Failed to generate response.');
              applyImmediateMood('idle');
            }
          } catch {
            setChatError('Received an invalid chat stream event.');
          }
        };

        ws.onerror = () => {
          setChatError('Connection issue detected. Attempting to reconnect.');
        };

        ws.onclose = () => {
          wsRef.current = null;
          stopHeartbeat();
          setWsState('closed');

          if (!unmountedRef.current && shouldReconnectRef.current) {
            scheduleReconnect(activeSessionId);
          }
        };
      } catch (err) {
        if (isAuthError(err)) {
          await onAuthFailure();
          return;
        }
        setChatError('Could not open chat connection. Retrying.');
        scheduleReconnect(activeSessionId);
      }
    },
    [
      applyImmediateMood,
      clearReconnectTimers,
      getWebSocketUrl,
      onAuthFailure,
      queueMoodUpdate,
      scheduleReconnect,
      scheduleIdleReset,
      setChatError,
      setHasFirstChunk,
      setIsReplying,
      setMessages,
      setReconnectInSec,
      setWsState,
      stopHeartbeat,
      userId,
    ]
  );

  useEffect(() => {
    connectWebSocketRef.current = (activeSessionId, isReconnect) => {
      void connectWebSocket(activeSessionId, isReconnect);
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (sessionId === null || !userId) return;
    void connectWebSocket(sessionId, reconnectingRef.current);
  }, [sessionId, userId, connectWebSocket]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      closeSocket();
    };
  }, [closeSocket]);

  const sendMessage = useCallback(
    (messageToSend: string) => {
      if (!messageToSend || sessionId === null) return false;

      const optimisticId = localIdRef.current;
      const timestamp = new Date().toISOString();
      const payload = JSON.stringify({
        message: messageToSend,
        type: 'message',
      });

      const userMessage: MessageRead = {
        chat_session_id: sessionId,
        content: messageToSend,
        id: optimisticId,
        is_user: true,
        owner_id: userId ?? '',
        timestamp,
      };
      localIdRef.current -= 1;

      setMessages((prev) => [...prev, userMessage]);
      setIsReplying(true);
      setHasFirstChunk(false);
      setChatError(null);
      applyImmediateMood('thinking');
      assistantMessageIdRef.current = null;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(payload);
        return true;
      }

      unsentQueueRef.current.push({
        content: messageToSend,
        optimisticId,
        payload,
        timestamp,
      });
      void connectWebSocket(sessionId, true);
      return true;
    },
    [
      applyImmediateMood,
      connectWebSocket,
      sessionId,
      setChatError,
      setHasFirstChunk,
      setIsReplying,
      setMessages,
      userId,
    ]
  );

  const stopGeneration = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }));
    }
  }, []);

  const reconcileFetchedMessages = useCallback(
    (serverMessages: MessageRead[]) => {
      if (unsentQueueRef.current.length === 0) {
        return serverMessages;
      }

      const pendingMessages = unsentQueueRef.current.filter((pending) => {
        return !serverMessages.some(
          (message) =>
            message.is_user &&
            message.content === pending.content &&
            new Date(message.timestamp).getTime() >= new Date(pending.timestamp).getTime() - 1_000
        );
      });

      unsentQueueRef.current = pendingMessages;

      if (pendingMessages.length === 0) {
        return serverMessages;
      }

      const optimisticMessages: MessageRead[] = pendingMessages.map((pending) => ({
        chat_session_id: sessionId ?? 0,
        content: pending.content,
        id: pending.optimisticId,
        is_user: true,
        owner_id: userId ?? '',
        timestamp: pending.timestamp,
      }));

      return [...serverMessages, ...optimisticMessages];
    },
    [sessionId, userId]
  );

  return {
    closeSocket,
    reconcileFetchedMessages,
    sendMessage,
    stopGeneration,
  };
}
