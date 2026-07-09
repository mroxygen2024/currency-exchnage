import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRealtimeRates, type RateUpdate } from '../useRealtimeRates';
import { useWebSocket } from '../useWebSocket';

vi.mock('../useWebSocket', () => ({
  useWebSocket: vi.fn(),
}));

const mockSend = vi.fn();

function defaultWsMock() {
  return {
    status: 'connecting' as const,
    lastMessage: null,
    send: mockSend,
    disconnect: vi.fn(),
  };
}

function TestRatesComponent({
  initialPairs,
}: {
  initialPairs?: string[];
}) {
  const { rates, status, subscribe, unsubscribe, clearSubscriptions } =
    useRealtimeRates(initialPairs);

  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="rates-json">{JSON.stringify(rates)}</div>
      <button data-testid="btn-subscribe" onClick={() => subscribe('EURUSD')}>
        Subscribe EURUSD
      </button>
      <button
        data-testid="btn-subscribe-multi"
        onClick={() => subscribe(['GBPUSD', 'USDJPY'])}
      >
        Subscribe Multi
      </button>
      <button
        data-testid="btn-unsubscribe"
        onClick={() => unsubscribe('EURUSD')}
      >
        Unsubscribe EURUSD
      </button>
      <button
        data-testid="btn-clear"
        onClick={() => clearSubscriptions()}
      >
        Clear
      </button>
    </div>
  );
}

let onMessageHandler: ((event: MessageEvent) => void) | null = null;

describe('useRealtimeRates', () => {
  beforeEach(() => {
    onMessageHandler = null;
    mockSend.mockClear();
    vi.mocked(useWebSocket).mockImplementation((_url, options) => {
      if (options?.onMessage) {
        onMessageHandler = options.onMessage;
      }
      return defaultWsMock();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function simulateRateUpdate(pair: string, rate: number): void {
    if (!onMessageHandler) return;
    const payload: RateUpdate = {
      event: 'rate_update',
      pair,
      base: pair.slice(0, 3).toUpperCase(),
      target: pair.slice(3).toUpperCase(),
      rate,
      timestamp: new Date().toISOString(),
    };
    onMessageHandler(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }

  it('connects and reports connection status', () => {
    render(<TestRatesComponent />);
    expect(screen.getByTestId('status')).toHaveTextContent('connecting');
  });

  it('starts with empty rates', () => {
    render(<TestRatesComponent />);
    expect(screen.getByTestId('rates-json')).toHaveTextContent('{}');
  });

  it('subscribes to a single pair via subscribe action', async () => {
    render(<TestRatesComponent />);

    await act(() => {
      screen.getByTestId('btn-subscribe').click();
    });

    expect(mockSend).toHaveBeenCalledWith({
      action: 'subscribe',
      pairs: ['EURUSD'],
    });
  });

  it('subscribes to multiple pairs', async () => {
    render(<TestRatesComponent />);

    await act(() => {
      screen.getByTestId('btn-subscribe-multi').click();
    });

    expect(mockSend).toHaveBeenCalledWith({
      action: 'subscribe',
      pairs: ['GBPUSD', 'USDJPY'],
    });
  });

  it('unsubscribes from a pair', async () => {
    render(<TestRatesComponent />);

    await act(() => {
      screen.getByTestId('btn-subscribe').click();
    });
    mockSend.mockClear();

    await act(() => {
      screen.getByTestId('btn-unsubscribe').click();
    });

    expect(mockSend).toHaveBeenCalledWith({
      action: 'unsubscribe',
      pairs: ['EURUSD'],
    });
  });

  it('updates rates when receiving rate_update messages', async () => {
    render(<TestRatesComponent />);

    await act(() => {
      simulateRateUpdate('EURUSD', 1.1234);
    });

    const ratesText = screen.getByTestId('rates-json').textContent;
    expect(ratesText).toContain('"EURUSD"');
    expect(ratesText).toContain('1.1234');
  });

  it('accumulates rates for multiple pairs', async () => {
    render(<TestRatesComponent />);

    await act(() => {
      simulateRateUpdate('EURUSD', 1.12);
      simulateRateUpdate('GBPUSD', 1.31);
      simulateRateUpdate('USDJPY', 149.5);
    });

    const ratesText = screen.getByTestId('rates-json').textContent;
    const parsed = JSON.parse(ratesText!);
    expect(parsed.EURUSD).toBe(1.12);
    expect(parsed.GBPUSD).toBe(1.31);
    expect(parsed.USDJPY).toBe(149.5);
  });

  it('updates existing rate for a pair', async () => {
    render(<TestRatesComponent />);

    await act(() => {
      simulateRateUpdate('EURUSD', 1.12);
    });

    await act(() => {
      simulateRateUpdate('EURUSD', 1.15);
    });

    const ratesText = screen.getByTestId('rates-json').textContent;
    const parsed = JSON.parse(ratesText!);
    expect(parsed.EURUSD).toBe(1.15);
  });

  it('ignores non-rate_update messages', async () => {
    render(<TestRatesComponent />);

    if (onMessageHandler) {
      await act(() => {
        onMessageHandler!(
          new MessageEvent('message', {
            data: JSON.stringify({ event: 'pong' }),
          })
        );
      });
    }

    expect(screen.getByTestId('rates-json')).toHaveTextContent('{}');
  });

  it('clearSubscriptions unsubscribes all pairs and resets rates', async () => {
    render(<TestRatesComponent />);

    // Add some rates
    await act(() => {
      simulateRateUpdate('EURUSD', 1.12);
      simulateRateUpdate('GBPUSD', 1.31);
    });

    // Subscribe to pairs so clearSubscriptions knows about them
    await act(() => {
      screen.getByTestId('btn-subscribe').click();
      screen.getByTestId('btn-subscribe-multi').click();
    });

    mockSend.mockClear();

    await act(() => {
      screen.getByTestId('btn-clear').click();
    });

    // Should have sent unsubscribe for tracked pairs
    expect(mockSend).toHaveBeenCalledWith({
      action: 'unsubscribe',
      pairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
    });

    // Rates should be cleared
    expect(screen.getByTestId('rates-json')).toHaveTextContent('{}');
  });

  it('normalizes pair codes to uppercase', async () => {
    render(<TestRatesComponent />);

    // Send lowercase pair
    await act(() => {
      simulateRateUpdate('eurusd', 1.12);
    });

    const ratesText = screen.getByTestId('rates-json').textContent;
    expect(ratesText).toContain('"EURUSD"');
  });
});
