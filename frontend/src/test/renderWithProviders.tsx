import { type ReactNode, useMemo } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  route?: string;
}

export function renderWithProviders(
  ui: ReactNode,
  {
    queryClient = createTestQueryClient(),
    route = '/',
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  window.history.pushState({}, '', route);

  function Wrapper({ children }: { children: ReactNode }) {
    const client = useMemo(() => queryClient, []);
    return (
      <QueryClientProvider client={client}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

export { createTestQueryClient };
