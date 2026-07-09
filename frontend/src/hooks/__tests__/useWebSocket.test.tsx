import { render, screen, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useWebSocket } from '../useWebSocket';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  send = vi.fn();
  close = vi.fn().mockImplementation(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean { return true; }

  _open(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen(new Event('open'));
  }

  _close(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose(new CloseEvent('close'));
  }

  _message(data: string): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  _error(): void {
    if (this.onerror) this.onerror(new Event('error'));
  }
}

let mockWsInstances: MockWebSocket[] = [];

function TestComponent({
  url,
  opts,
}: {
  url: string | null;
  opts?: Partial<Parameters<typeof useWebSocket>[1]>;
}) {
  const { status, lastMessage, send, disconnect } = useWebSocket(url, opts);

  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="last-message">
        {lastMessage ? (lastMessage.data as string) : 'null'}
      </div>
      <button data-testid="btn-send-string" onClick={() => send('hello')}>
        Send String
      </button>
      <button data-testid="btn-send-json" onClick={() => send({ action: 'ping' })}>
        Send JSON
      </button>
      <button data-testid="btn-disconnect" onClick={() => disconnect()}>
        Disconnect
      </button>
    </div>
  );
}

function getLatestWs(): MockWebSocket {
  const ws = mockWsInstances[mockWsInstances.length - 1];
  if (!ws) throw new Error('No WebSocket instance created');
  return ws;
}

describe('useWebSocket', () => {
  let OriginalWebSocket: typeof WebSocket;

  beforeEach(() => {
    mockWsInstances = [];
    OriginalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url);
        mockWsInstances.push(this);
      }
    } as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it('initializes in disconnected state', () => {
    render(<TestComponent url={null} />);
    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
  });

  it('transitions from connecting to connected', async () => {
    render(<TestComponent url="ws://localhost:8000/ws/test" />);
    expect(screen.getByTestId('status')).toHaveTextContent('connecting');

    await act(() => {
      getLatestWs()._open();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('connected');
  });

  it('calls onOpen callback when connection opens', async () => {
    const onOpen = vi.fn();
    render(<TestComponent url="ws://localhost:8000/ws/test" opts={{ onOpen }} />);

    await act(() => {
      getLatestWs()._open();
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('transitions to disconnected on close and reconnects', async () => {
    render(
      <TestComponent
        url="ws://localhost:8000/ws/test"
        opts={{ reconnectInterval: 10, reconnectAttempts: 3 }}
      />
    );

    await act(() => {
      getLatestWs()._open();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('connected');

    // Close to trigger reconnect
    await act(() => {
      getLatestWs()._close();
    });
    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');

    // New WebSocket should be created for reconnect
    await vi.waitFor(() => {
      expect(mockWsInstances.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('stops reconnecting after max attempts', async () => {
    render(
      <TestComponent
        url="ws://localhost:8000/ws/test"
        opts={{ reconnectInterval: 10, reconnectAttempts: 2 }}
      />
    );

    // Close 3 times (max 2 reconnect attempts)
    for (let i = 0; i < 4; i++) {
      await act(() => {
        const ws = mockWsInstances[mockWsInstances.length - 1];
        if (ws) ws._close();
      });
      // Give time for reconnect logic
      await vi.waitFor(() => {}, { timeout: 50 });
    }

    await vi.waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
    });
  });

  it('sends string messages when connection is open', async () => {
    render(<TestComponent url="ws://localhost:8000/ws/test" />);

    await act(() => {
      getLatestWs()._open();
    });

    const ws = getLatestWs();
    await act(() => {
      screen.getByTestId('btn-send-string').click();
    });

    expect(ws.send).toHaveBeenCalledWith('hello');
  });

  it('sends JSON object messages', async () => {
    render(<TestComponent url="ws://localhost:8000/ws/test" />);

    await act(() => {
      getLatestWs()._open();
    });

    const ws = getLatestWs();
    await act(() => {
      screen.getByTestId('btn-send-json').click();
    });

    expect(ws.send).toHaveBeenCalledWith('{"action":"ping"}');
  });

  it('updates lastMessage on incoming message', async () => {
    render(<TestComponent url="ws://localhost:8000/ws/test" />);

    await act(() => {
      getLatestWs()._open();
    });

    await act(() => {
      getLatestWs()._message('{"event":"pong"}');
    });

    expect(screen.getByTestId('last-message')).toHaveTextContent('{"event":"pong"}');
  });

  it('calls onMessage callback when message received', async () => {
    const onMessage = vi.fn();
    render(<TestComponent url="ws://localhost:8000/ws/test" opts={{ onMessage }} />);

    await act(() => {
      getLatestWs()._open();
    });

    await act(() => {
      getLatestWs()._message('test data');
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('disconnect prevents auto-reconnect', async () => {
    render(
      <TestComponent
        url="ws://localhost:8000/ws/test"
        opts={{ reconnectInterval: 10, reconnectAttempts: 5 }}
      />
    );

    await act(() => {
      getLatestWs()._open();
    });

    await act(() => {
      screen.getByTestId('btn-disconnect').click();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');

    // Close after manual disconnect should NOT reconnect
    const instanceCount = mockWsInstances.length;
    await act(() => {
      getLatestWs()._close();
    });

    // No new instances should be created
    expect(mockWsInstances.length).toBe(instanceCount);
  });

  it('does not connect when enabled is false', async () => {
    render(
      <TestComponent url="ws://localhost:8000/ws/test" opts={{ enabled: false }} />
    );

    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
  });

  it('cleans up on unmount', async () => {
    const { unmount } = render(<TestComponent url="ws://localhost:8000/ws/test" />);

    await act(() => {
      getLatestWs()._open();
    });

    const ws = getLatestWs();
    unmount();

    expect(ws.close).toHaveBeenCalled();
  });
});
