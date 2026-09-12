'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WS_BASE_URL } from '@/src/shared/api/config';
import { getToken } from '@/src/shared/api/client';
import type { WsInboundMessage, WsOutboundBid } from '@/src/shared/types/api';

export type SocketStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error'
  | 'finished';

const RECONNECT_DELAY_MS = 3000;
const MAX_RETRIES = 5;

interface UseAuctionSocketOptions {
  lotId: number | string | null;
  onMessage: (msg: WsInboundMessage) => void;
  enabled?: boolean;
}

interface UseAuctionSocketResult {
  status: SocketStatus;
  sendBid: (amount: number) => boolean;
  close: () => void;
}

/**
 * Real-time auction socket. Connects once per lotId; reconnects on drop
 * with a capped backoff. Cleans up on unmount.
 */
export function useAuctionSocket({
  lotId,
  onMessage,
  enabled = true,
}: UseAuctionSocketOptions): UseAuctionSocketResult {
  const [status, setStatus] = useState<SocketStatus>('idle');
  const socketRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedManuallyRef = useRef(false);
  const finishedRef = useRef(false);

  // Keep latest message handler without re-opening the socket.
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    closedManuallyRef.current = true;
    clearTimers();
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus('closed');
  }, [clearTimers]);

  useEffect(() => {
    if (!enabled || lotId == null) return;

    closedManuallyRef.current = false;
    finishedRef.current = false;
    retriesRef.current = 0;

    const connect = () => {
      const token = getToken();
      if (!token) {
        // Token not ready yet (e.g. during hydration). Schedule a retry
        // instead of giving up permanently.
        if (retriesRef.current < MAX_RETRIES) {
          retriesRef.current += 1;
          setStatus('connecting');
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        } else {
          setStatus('error');
        }
        return;
      }
      const url = `${WS_BASE_URL}/ws/lots/${lotId}?token=${token}`;
      const ws = new WebSocket(url);
      socketRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => {
        retriesRef.current = 0;
        setStatus('open');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsInboundMessage;
          if (msg.type === 'AUCTION_FINISHED') {
            finishedRef.current = true;
            setStatus('finished');
          }
          onMessageRef.current(msg);
        } catch {
          // ignore malformed payloads
        }
      };

      ws.onerror = () => {
        setStatus('error');
      };

      ws.onclose = () => {
        socketRef.current = null;
        if (closedManuallyRef.current || finishedRef.current) {
          setStatus('closed');
          return;
        }
        if (retriesRef.current < MAX_RETRIES) {
          retriesRef.current += 1;
          setStatus('connecting');
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        } else {
          setStatus('error');
        }
      };
    };

    connect();

    return () => {
      close();
    };
    // lotId + enabled only: avoid reconnecting on callback identity churn.
  }, [lotId, enabled, close, clearTimers]);

  const sendBid = useCallback((amount: number) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    const payload: WsOutboundBid = { type: 'PLACE_BID', amount };
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  return { status, sendBid, close };
}
