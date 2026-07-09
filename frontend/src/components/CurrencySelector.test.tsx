import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { CurrencySelector } from './CurrencySelector';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('CurrencySelector', () => {
  it('renders with label', () => {
    render(
      <CurrencySelector value="USD" onChange={vi.fn()} label="From Currency" />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText('From Currency')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(
      <CurrencySelector value="USD" onChange={vi.fn()} />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('calls onChange when option selected', async () => {
    const onChange = vi.fn();
    render(
      <CurrencySelector value="USD" onChange={onChange} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('USD')).toBeInTheDocument();
    });

    const trigger = screen.getByRole('button', { name: /usd/i });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const eurOption = screen.getAllByRole('option').find(
      (el) => el.textContent?.includes('EUR')
    );
    if (eurOption) {
      fireEvent.click(eurOption);
      expect(onChange).toHaveBeenCalledWith('EUR');
    }
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <CurrencySelector value="USD" onChange={vi.fn()} disabled />,
      { wrapper: createWrapper() }
    );
    const button = screen.getByRole('button', { name: /usd/i });
    expect(button).toBeDisabled();
  });

  it('excludes specified currencies from dropdown', async () => {
    render(
      <CurrencySelector value="USD" onChange={vi.fn()} exclude={['EUR']} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('USD')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /usd/i }));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const options = screen.getAllByRole('option');
    const eurOption = options.find((el) => el.textContent?.includes('EUR'));
    expect(eurOption).toBeUndefined();
  });

  it('shows selected checkmark', async () => {
    render(
      <CurrencySelector value="USD" onChange={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('USD')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /usd/i }));

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const usdOption = screen.getAllByRole('option').find(
      (el) => el.textContent?.includes('USD')
    );
    expect(usdOption).toHaveAttribute('aria-selected', 'true');
  });
});
