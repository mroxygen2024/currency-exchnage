import { useCallback, useMemo, useState } from 'react';
import { API_CONFIG } from '../api/config';
import {
  useWebSocket,
  type ConnectionStatus,
  type UseWebSocketOptions,
} from './useWebSocket';

const WS_RATES_PATH = '/ws/rates';

export interface RateUpdate {
  event: 'rate_update';
  pair: string;
  base: string;
  target: string;
  rate: number;
  timestamp: string;
}

export interface RealtimeRatesState {
  rates: Record<string, number>;
  status: ConnectionStatus;
  subscribe: (pairs: string | string[]) => void;
  unsubscribe: (pairs: string | string[]) => void;
  clearSubscriptions: () => void;
}

function getWsRatesUrl(): string {
  const url = new URL(API_CONFIG.BASE_URL);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}${WS_RATES_PATH}`;
}

export function useRealtimeRates(
  initialPairs?: string[],
  options?: Pick<UseWebSocketOptions, 'autoReconnect' | 'reconnectAttempts' | 'reconnectInterval'>
): RealtimeRatesState {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [subscribedPairs, setSubscribedPairs] = useState<Set<string>>(
    () => new Set(initialPairs)
  );

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as RateUpdate;
      if (
        data.event === 'rate_update' &&
        data.pair &&
        typeof data.rate === 'number'
      ) {
        const pair = data.pair.toUpperCase();
        setRates((prev) => {
          if (prev[pair] === data.rate) return prev;
          return { ...prev, [pair]: data.rate };
        });
      }
    } catch {
      // ignore malformed messages
    }
  }, []);

  const wsUrl = useMemo(() => getWsRatesUrl(), []);
  const reconnectAttempts = options?.reconnectAttempts ?? 5;
  const reconnectInterval = options?.reconnectInterval ?? 3000;
  const autoReconnect = options?.autoReconnect ?? true;

  const wsOptions: UseWebSocketOptions = useMemo(
    () => ({
      onMessage: handleMessage,
      reconnectAttempts,
      reconnectInterval,
      autoReconnect,
    }),
    [handleMessage, reconnectAttempts, reconnectInterval, autoReconnect]
  );

  const { status, send } = useWebSocket(wsUrl, wsOptions);

  const subscribe = useCallback(
    (pairs: string | string[]) => {
      const pairList = Array.isArray(pairs) ? pairs : [pairs];
      const validPairs = pairList
        .map((p) => p.toUpperCase().trim())
        .filter((p) => p.length === 6);

      if (validPairs.length === 0) return;

      setSubscribedPairs((prev) => {
        const next = new Set(prev);
        for (const p of validPairs) next.add(p);
        return next;
      });

      send({ action: 'subscribe', pairs: validPairs });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (pairs: string | string[]) => {
      const pairList = Array.isArray(pairs) ? pairs : [pairs];
      const validPairs = pairList
        .map((p) => p.toUpperCase().trim())
        .filter((p) => p.length === 6);

      if (validPairs.length === 0) return;

      setSubscribedPairs((prev) => {
        const next = new Set(prev);
        for (const p of validPairs) next.delete(p);
        return next;
      });

      send({ action: 'unsubscribe', pairs: validPairs });
    },
    [send]
  );

  const clearSubscriptions = useCallback(() => {
    const current = Array.from(subscribedPairs);
    if (current.length > 0) {
      send({ action: 'unsubscribe', pairs: current });
    }
    setSubscribedPairs(new Set());
    setRates({});
  }, [send, subscribedPairs]);

  return {
    rates,
    status,
    subscribe,
    unsubscribe,
    clearSubscriptions,
  };
}
