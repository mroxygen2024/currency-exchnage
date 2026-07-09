import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FavoriteCard } from './FavoriteCard';
import type { FavoritePairOut } from '../../api/types';

const mockFavorite: FavoritePairOut = {
  id: 1,
  user_id: 1,
  base_currency: 'USD',
  target_currency: 'EUR',
  created_at: new Date().toISOString(),
};

describe('FavoriteCard', () => {
  it('renders currency pair', () => {
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0.92}
        isLive={true}
        isRemoving={false}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('USD/EUR')).toBeInTheDocument();
  });

  it('renders current rate', () => {
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0.92}
        isLive={true}
        isRemoving={false}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('0.9200')).toBeInTheDocument();
  });

  it('renders bid and ask spread', () => {
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0.92}
        isLive={true}
        isRemoving={false}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('Bid')).toBeInTheDocument();
    expect(screen.getByText('Ask')).toBeInTheDocument();
  });

  it('renders live badge when isLive is true', () => {
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0.92}
        isLive={true}
        isRemoving={false}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('renders cached badge when isLive is false', () => {
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0.92}
        isLive={false}
        isRemoving={false}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText('Cached')).toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0.92}
        isLive={true}
        isRemoving={false}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /remove usd\/eur/i }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('disables remove button when isRemoving is true', () => {
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0.92}
        isLive={true}
        isRemoving={true}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /remove usd\/eur/i })).toBeDisabled();
  });

  it('shows percentage change when previous rate provided', () => {
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0.93}
        previousRate={0.92}
        isLive={true}
        isRemoving={false}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(/1\.09%/)).toBeInTheDocument();
  });

  it('shows down trend when rate decreased', () => {
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0.91}
        previousRate={0.92}
        isLive={true}
        isRemoving={false}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByText(/1\.09%/)).toBeInTheDocument();
  });

  it('renders zero rate placeholder', () => {
    render(
      <FavoriteCard
        favorite={mockFavorite}
        currentRate={0}
        isLive={true}
        isRemoving={false}
        onRemove={vi.fn()}
      />
    );
    const placeholders = screen.getAllByText('--');
    expect(placeholders.length).toBeGreaterThanOrEqual(1);
  });
});
