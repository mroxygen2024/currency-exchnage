import { TrendingDown, TrendingUp, Trash2 } from 'lucide-react';
import { FavoritePairOut } from '../../api/types';
import { getCurrencyFlag } from '../CurrencySelector';

export interface FavoriteCardProps {
  favorite: FavoritePairOut;
  currentRate: number;
  previousRate?: number;
  isLive: boolean;
  isRemoving: boolean;
  onRemove: (id: number) => void;
  delay?: number;
}

export function FavoriteCard({
  favorite,
  currentRate,
  previousRate,
  isLive,
  isRemoving,
  onRemove,
  delay = 0,
}: FavoriteCardProps) {
  const hasPrevious = previousRate !== undefined && previousRate > 0;
  const direction =
    hasPrevious && currentRate > 0
      ? currentRate > previousRate!
        ? 'up'
        : currentRate < previousRate!
          ? 'down'
          : 'neutral'
      : 'neutral';

  const changePct =
    hasPrevious && previousRate! > 0
      ? ((currentRate - previousRate!) / previousRate! * 100)
      : 0;

  const bid = currentRate > 0 ? currentRate * 0.9995 : 0;
  const ask = currentRate > 0 ? currentRate * 1.0005 : 0;

  return (
    <div
      className="fav-card animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
      style={{ animationDelay: `${delay}ms` }}
      data-testid={`fav-card-${favorite.id}`}
    >
      <div className="fav-card__header">
        <div className="fav-card__pair">
          <span className="fav-card__flag" aria-hidden="true">
            {getCurrencyFlag(favorite.base_currency)}
          </span>
          <span className="fav-card__flag" aria-hidden="true">
            {getCurrencyFlag(favorite.target_currency)}
          </span>
          <span className="fav-card__code">
            {favorite.base_currency}/{favorite.target_currency}
          </span>
        </div>

        <div className="fav-card__header-right">
          {direction !== 'neutral' && (
            <span
              className={`fav-card__change ${
                direction === 'up' ? 'fav-card__change--up' : 'fav-card__change--down'
              }`}
            >
              {direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(changePct).toFixed(2)}%
            </span>
          )}
          <span className={`fav-card__status ${isLive ? 'fav-card__status--live' : ''}`}>
            {isLive ? 'Live' : 'Cached'}
          </span>
        </div>
      </div>

      <div className="fav-card__price">
        <span className="fav-card__mid-label">Mid Price</span>
        <span className="fav-card__mid-value">
          {currentRate > 0 ? currentRate.toFixed(4) : '--'}
        </span>
      </div>

      <div className="fav-card__spread">
        <div className="fav-card__spread-item">
          <span className="fav-card__spread-label">Bid</span>
          <span className="fav-card__spread-value">
            {currentRate > 0 ? bid.toFixed(4) : '--'}
          </span>
        </div>
        <div className="fav-card__spread-divider" />
        <div className="fav-card__spread-item">
          <span className="fav-card__spread-label">Ask</span>
          <span className="fav-card__spread-value">
            {currentRate > 0 ? ask.toFixed(4) : '--'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRemove(favorite.id)}
        disabled={isRemoving}
        className="fav-card__remove"
        aria-label={`Remove ${favorite.base_currency}/${favorite.target_currency} from favorites`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
