import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { useSupportedCurrencies, useCurrencySymbols } from '../hooks/useCurrency';
import { cn } from '../lib/utils';

export interface CurrencySelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  exclude?: string[];
  className?: string;
}

// Map common currency codes to flag emojis for visual flair
export function getCurrencyFlag(currencyCode: string): string {
  const flags: Record<string, string> = {
    USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
    CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', HKD: '🇭🇰', NZD: '🇳🇿',
    SEK: '🇸🇪', KRW: '🇰🇷', SGD: '🇸🇬', NOK: '🇳🇴', MXN: '🇲🇽',
    INR: '🇮🇳', RUB: '🇷🇺', ZAR: '🇿🇦', TRY: '🇹🇷', BRL: '🇧🇷',
    TWD: '🇹🇼', DKK: '🇩🇰', PLN: '🇵🇱', THB: '🇹🇭', IDR: '🇮🇩',
    HUF: '🇭🇺', CZK: '🇨🇿', ILS: '🇮🇱', CLP: '🇨🇱', PHP: '🇵🇭',
    AED: '🇦🇪', COP: '🇨🇴', SAR: '🇸🇦', MYR: '🇲🇾', RON: '🇷🇴',
    ARS: '🇦🇷', UAH: '🇺🇦', EGP: '🇪🇬', VND: '🇻🇳', KWD: '🇰🇼',
    DZD: '🇩🇿', MAD: '🇲🇦', QAR: '🇶🇦', PEN: '🇵🇪', BHD: '🇧🇭',
  };
  return flags[currencyCode.toUpperCase()] || '🏳️';
}

export function CurrencySelector({
  value,
  onChange,
  label,
  disabled = false,
  exclude = [],
  className,
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Queries
  const {
    data: supportedCodes,
    isLoading: isLoadingCodes,
    error: errorCodes,
    refetch: refetchCodes,
  } = useSupportedCurrencies();

  const {
    data: symbols,
    isLoading: isLoadingSymbols,
    error: errorSymbols,
    refetch: refetchSymbols,
  } = useCurrencySymbols();

  const isLoading = isLoadingCodes || isLoadingSymbols;
  const hasError = !!errorCodes || !!errorSymbols;

  // Filter list of currencies based on search query and exclusions
  const filteredCurrencies = React.useMemo(() => {
    if (!supportedCodes) return [];

    const normalizedQuery = searchQuery.toLowerCase().trim();
    return supportedCodes
      .filter((code) => !exclude.includes(code))
      .map((code) => ({
        code,
        name: symbols?.[code] || 'Unknown Currency',
      }))
      .filter(
        (curr) =>
          curr.code.toLowerCase().includes(normalizedQuery) ||
          curr.name.toLowerCase().includes(normalizedQuery)
      );
  }, [supportedCodes, symbols, searchQuery, exclude]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      setSearchQuery('');
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-highlighted="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (errorCodes) refetchCodes();
    if (errorSymbols) refetchSymbols();
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || hasError || isLoading) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (filteredCurrencies[highlightedIndex]) {
          handleSelect(filteredCurrencies[highlightedIndex].code);
        }
        break;
      case 'Escape':
      case 'Tab':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredCurrencies.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      default:
        break;
    }
  };

  const selectedName = symbols?.[value] || '';

  return (
    <div className={cn('relative flex flex-col gap-1.5 w-full', className)} ref={containerRef}>
      {label && (
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
          {label}
        </span>
      )}

      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-left transition-all duration-250 cursor-pointer outline-none hover:bg-white/80 hover:border-slate-300 focus:border-slate-400 focus:ring-4 focus:ring-slate-100',
          disabled && 'opacity-65 cursor-not-allowed bg-slate-50/50 hover:bg-slate-50/50 hover:border-slate-200',
          isOpen && 'border-slate-400 ring-4 ring-slate-100 bg-white/95'
        )}
      >
        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="w-5 h-5 rounded-full bg-slate-200 animate-pulse" />
          ) : hasError ? (
            <AlertCircle className="w-5 h-5 text-rose-500" />
          ) : (
            <span className="text-xl leading-none select-none" aria-hidden="true">
              {getCurrencyFlag(value)}
            </span>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 text-sm md:text-base uppercase tracking-wide">
              {isLoading ? (
                <span className="inline-block w-8 h-4 bg-slate-200 animate-pulse rounded" />
              ) : hasError ? (
                <span className="text-rose-500 font-normal">Failed to load</span>
              ) : (
                value
              )}
            </span>
            {selectedName && (
              <span className="text-xs text-slate-400 font-medium truncate max-w-[140px] sm:max-w-[200px]">
                {selectedName}
              </span>
            )}
          </div>
        </div>

        {hasError ? (
          <button
            type="button"
            onClick={handleRetry}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            title="Retry loading currencies"
            aria-label="Retry loading currencies"
          >
            <RefreshCw className="w-4 h-4 animate-spin-hover" />
          </button>
        ) : (
          <ChevronDown
            className={cn(
              'w-5 h-5 text-slate-400 transition-transform duration-250',
              isOpen && 'transform rotate-180 text-slate-600'
            )}
          />
        )}
      </button>

      {/* Dropdown List Wrapper */}
      {isOpen && !hasError && !isLoading && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 w-full bg-white/95 backdrop-blur-lg border border-slate-200 shadow-xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search Header */}
          <div className="relative flex items-center border-b border-slate-100 px-3 py-2">
            <Search className="absolute left-4 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
              aria-label="Search currency"
            />
          </div>

          {/* Currencies Scroll Area */}
          <div
            ref={listRef}
            className="max-h-[240px] overflow-y-auto py-1.5 scrollbar-thin"
            role="listbox"
            aria-label="Currency options"
          >
            {filteredCurrencies.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                No matching currencies found.
              </div>
            ) : (
              filteredCurrencies.map((curr, index) => {
                const isSelected = curr.code === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={curr.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-highlighted={isHighlighted}
                    onClick={() => handleSelect(curr.code)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'flex items-center justify-between w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer outline-none',
                      isHighlighted && 'bg-slate-50',
                      isSelected && 'bg-slate-50/50 font-medium'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg leading-none" aria-hidden="true">
                        {getCurrencyFlag(curr.code)}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 uppercase">
                          {curr.code}
                        </span>
                        <span className="text-xs text-slate-400">
                          {curr.name}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-slate-600 stroke-[2.5]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
