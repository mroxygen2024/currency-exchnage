import { memo } from 'react';

interface RateRow {
  pair: string;
  from: string;
  to: string;
  rate: number;
  trend: 'up' | 'down';
  change: string;
  sparkline: string;
}

interface RatesTableProps {
  data: RateRow[];
  symbols: Record<string, string>;
  isLoading: boolean;
  onSelect: (from: string, to: string) => void;
}

function RatesTableInner({ data, symbols, isLoading, onSelect }: RatesTableProps) {
  return (
    <section id="rates" className="rates-section">
      <div className="section-header">
        <span className="eyebrow">Market Rates</span>
        <h2>Top Currency Pairs</h2>
        <p>Monitor major currencies with real-time rates and instant calculator integration.</p>
      </div>

      <div className="rates-table-container">
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="button-spinner" style={{ borderColor: 'rgba(11, 105, 116, 0.2)', borderTopColor: '#0b6974', width: '32px', height: '32px', marginBottom: '16px' }} />
            <p className="eyebrow">Fetching market rates...</p>
          </div>
        ) : (
          <table className="rates-table" role="table" aria-label="Exchange rates for major currency pairs">
            <thead>
              <tr>
                <th scope="col">Currency Pair</th>
                <th scope="col">Exchange Rate</th>
                <th scope="col">24h Trend</th>
                <th scope="col">Weekly Trend</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.pair}>
                  <td>
                    <div className="currency-cell">
                      <span className="currency-flag-mock">{row.from}</span>
                      <span>{symbols[row.from] ?? row.from}</span>
                      <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>/</span>
                      <span className="currency-flag-mock" style={{ background: '#f0f3f5' }}>{row.to}</span>
                      <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>{row.to}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: '#10354a' }}>
                    {row.rate > 0 ? row.rate.toFixed(5) : '--'}
                  </td>
                  <td>
                    <span className={`trend-badge ${row.trend === 'up' ? 'trend-badge--up' : 'trend-badge--down'}`}>
                      {row.trend === 'up' ? '\u25B2' : '\u25BC'} {row.change}
                    </span>
                  </td>
                  <td>
                    <svg className={`sparkline-svg ${row.trend === 'up' ? 'sparkline-svg--up' : 'sparkline-svg--down'}`} aria-hidden="true">
                      <path d={row.sparkline} />
                    </svg>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-convert-shortcut"
                      onClick={() => onSelect(row.from, row.to)}
                      aria-label={`Convert ${row.from} to ${row.to}`}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export const RatesTable = memo(RatesTableInner);
