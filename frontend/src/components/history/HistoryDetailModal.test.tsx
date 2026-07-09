import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { HistoryDetailModal } from './HistoryDetailModal';
import { CurrencyConversionOut } from '../../api/types';

const mockRecord: CurrencyConversionOut = {
  id: 42,
  user_id: 1,
  from_currency: 'USD',
  to_currency: 'EUR',
  amount: 1500,
  rate: 0.92,
  result: 1380,
  converted_at: new Date('2026-07-09T10:30:00.000Z'),
};

describe('HistoryDetailModal', () => {
  it('renders the modal with record details', () => {
    render(<HistoryDetailModal record={mockRecord} onClose={vi.fn()} />);

    expect(screen.getByText('Conversion Details')).toBeInTheDocument();
    expect(screen.getByText('Record #42')).toBeInTheDocument();
  });

  it('displays from and to amounts', () => {
    render(<HistoryDetailModal record={mockRecord} onClose={vi.fn()} />);

    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText('1,500.00')).toBeInTheDocument();
    expect(screen.getByText('1,380.00')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
    expect(screen.getByText('EUR')).toBeInTheDocument();
  });

  it('displays exchange rate', () => {
    render(<HistoryDetailModal record={mockRecord} onClose={vi.fn()} />);

    expect(screen.getByText(/1 USD = 0\.92000 EUR/)).toBeInTheDocument();
  });

  it('displays status badge', () => {
    render(<HistoryDetailModal record={mockRecord} onClose={vi.fn()} />);

    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('displays formatted date and time', () => {
    render(<HistoryDetailModal record={mockRecord} onClose={vi.fn()} />);

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<HistoryDetailModal record={mockRecord} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close details/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn();
    render(<HistoryDetailModal record={mockRecord} onClose={onClose} />);

    const backdrop = screen.getByRole('dialog').querySelector('.absolute');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the footer close button', () => {
    const onClose = vi.fn();
    render(<HistoryDetailModal record={mockRecord} onClose={onClose} />);

    const footerCloseButton = screen.getByRole('button', { name: /^close$/i });
    fireEvent.click(footerCloseButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has proper accessibility attributes', () => {
    render(<HistoryDetailModal record={mockRecord} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Conversion record details');
  });
});
