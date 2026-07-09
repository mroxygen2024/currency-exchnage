import { useCallback, useEffect, useRef, useState } from 'react';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseWebSocketOptions {
  onMessage?: (event: MessageEvent) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoReconnect?: boolean;
  enabled?: boolean;
}

export interface UseWebSocketReturn {
  status: ConnectionStatus;
  lastMessage: MessageEvent | null;
  send: (data: string | object) => void;
  disconnect: () => void;
}

function getWsUrl(httpUrl: string, path: string): string {
  const url = new URL(httpUrl);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}${path}`;
}

export function useWebSocket(
  url: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    autoReconnect = true,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const shouldReconnectRef = useRef(false);

  const onMessageRef = useRef(options.onMessage);
  const onOpenRef = useRef(options.onOpen);
  const onCloseRef = useRef(options.onClose);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onMessageRef.current = options.onMessage;
    onOpenRef.current = options.onOpen;
    onCloseRef.current = options.onClose;
    onErrorRef.current = options.onError;
  });

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!url || !enabled) {
      setStatus('disconnected');
      return;
    }

    cleanup();
    setStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = (event) => {
        if (!mountedRef.current) return;
        setStatus('connected');
        reconnectCountRef.current = 0;
        onOpenRef.current?.(event);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        setStatus('disconnected');
        onCloseRef.current?.(event);

        if (
          autoReconnect &&
          reconnectCountRef.current < reconnectAttempts
        ) {
          reconnectCountRef.current += 1;
          shouldReconnectRef.current = true;
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setStatus('error');
        onErrorRef.current?.(new Event('error'));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        setLastMessage(event);
        onMessageRef.current?.(event);
      };
    } catch {
      if (!mountedRef.current) return;
      setStatus('error');
    }
  }, [url, enabled, reconnectAttempts, autoReconnect, cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => connect());
    return () => {
      reconnectCountRef.current = reconnectAttempts;
      cleanup();
    };
  }, [connect, cleanup, reconnectAttempts]);

  useEffect(() => {
    if (!shouldReconnectRef.current) return;
    shouldReconnectRef.current = false;

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, reconnectInterval);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect, reconnectInterval]);

  const send = useCallback((data: string | object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        typeof data === 'string' ? data : JSON.stringify(data)
      );
    }
  }, []);

  const disconnect = useCallback(() => {
    reconnectCountRef.current = reconnectAttempts;
    cleanup();
    setStatus('disconnected');
  }, [reconnectAttempts, cleanup]);

  return { status, lastMessage, send, disconnect };
}

export function useWebSocketUrl(httpBaseUrl: string, wsPath: string): string {
  return getWsUrl(httpBaseUrl, wsPath);
}
