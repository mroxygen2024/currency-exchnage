import { useEffect, useRef, useState } from 'react';

import { useAuth } from '../auth/AuthContext';
import { currencyApi } from '../api/endpoints/currency';
import { NavBar } from '../components/landing/NavBar';
import { HeroSection } from '../components/landing/HeroSection';
import { RatesTable } from '../components/landing/RatesTable';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { FAQSection } from '../components/landing/FAQSection';
import { Footer } from '../components/landing/Footer';

export function LandingPage() {
  const { isAuthenticated } = useAuth();

  const [symbols, setSymbols] = useState<Record<string, string>>({});
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([]);
  const [amount, setAmount] = useState<number>(1000);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [ratesTableData, setRatesTableData] = useState<Array<{
    pair: string;
    from: string;
    to: string;
    rate: number;
    trend: 'up' | 'down';
    change: string;
    sparkline: string;
  }>>([]);
  const [isLoadingRatesTable, setIsLoadingRatesTable] = useState(true);

  const heroCalculatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadSymbols() {
      try {
        const fetchedSymbols = await currencyApi.getSymbols();
        if (fetchedSymbols && Object.keys(fetchedSymbols).length > 0) {
          setSymbols(fetchedSymbols);
        }
        const fetchedSupported = await currencyApi.getSupported();
        if (fetchedSupported && fetchedSupported.length > 0) {
          setSupportedCurrencies(fetchedSupported);
        }
      } catch {
        // Keep empty state
      }
    }
    void loadSymbols();
  }, []);

  const handleConvert = async (
    currentAmount: number,
    currentFrom: string,
    currentTo: string
  ) => {
    if (currentAmount <= 0) {
      setConvertedAmount(0);
      setExchangeRate(null);
      return;
    }

    setIsConverting(true);

    try {
      const response = await currencyApi.convert({
        from: currentFrom,
        to: currentTo,
        amount: currentAmount,
      });

      setConvertedAmount(response.result);
      setExchangeRate(response.rate);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      setConvertedAmount(null);
      setExchangeRate(null);
    } finally {
      setIsConverting(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void handleConvert(amount, fromCurrency, toCurrency);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [amount, fromCurrency, toCurrency]);

  useEffect(() => {
    async function loadRatesTable() {
      setIsLoadingRatesTable(true);
      try {
        const pairs = [
          { from: 'EUR', to: 'USD', trend: 'up' as const, change: '+0.24%', sparkline: 'M0 16 Q20 5, 40 18 T80 4' },
          { from: 'GBP', to: 'USD', trend: 'up' as const, change: '+0.12%', sparkline: 'M0 18 Q20 10, 40 8 T80 6' },
          { from: 'USD', to: 'JPY', trend: 'down' as const, change: '-0.45%', sparkline: 'M0 5 Q20 22, 40 10 T80 20' },
          { from: 'AUD', to: 'USD', trend: 'down' as const, change: '-0.08%', sparkline: 'M0 10 Q20 18, 40 12 T80 16' },
          { from: 'USD', to: 'CAD', trend: 'up' as const, change: '+0.05%', sparkline: 'M0 15 Q20 15, 40 10 T80 8' },
        ];

        const resolvedPairs = await Promise.all(
          pairs.map(async (p) => {
            try {
              const rateData = await currencyApi.getRate(p.from, p.to);
              return {
                pair: `${p.from}/${p.to}`,
                from: p.from,
                to: p.to,
                rate: rateData.rate,
                trend: p.trend,
                change: p.change,
                sparkline: p.sparkline,
              };
            } catch {
              return {
                pair: `${p.from}/${p.to}`,
                from: p.from,
                to: p.to,
                rate: 0,
                trend: p.trend,
                change: p.change,
                sparkline: p.sparkline,
              };
            }
          })
        );
        setRatesTableData(resolvedPairs);
      } catch {
        // Keep empty state
      } finally {
        setIsLoadingRatesTable(false);
      }
    }
    void loadRatesTable();
  }, []);

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const scrollToCalculator = () => {
    if (heroCalculatorRef.current) {
      heroCalculatorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const amountInput = heroCalculatorRef.current.querySelector('input');
      if (amountInput) {
        amountInput.focus();
      }
    }
  };

  const handleRatesConvertShortcut = (from: string, to: string) => {
    setFromCurrency(from);
    setToCurrency(to);
    scrollToCalculator();
  };

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar />

      <main id="main-content" style={{ flexGrow: 1 }}>
        <HeroSection
          heroCalculatorRef={heroCalculatorRef}
          scrollToCalculator={scrollToCalculator}
          amount={amount}
          setAmount={setAmount}
          fromCurrency={fromCurrency}
          setFromCurrency={setFromCurrency}
          toCurrency={toCurrency}
          setToCurrency={setToCurrency}
          convertedAmount={convertedAmount}
          exchangeRate={exchangeRate}
          isConverting={isConverting}
          lastUpdated={lastUpdated}
          supportedCurrencies={supportedCurrencies}
          isAuthenticated={isAuthenticated}
          handleSwap={handleSwap}
        />

        <RatesTable
          data={ratesTableData}
          symbols={symbols}
          isLoading={isLoadingRatesTable}
          onSelect={handleRatesConvertShortcut}
        />

        <FeaturesSection />

        <FAQSection />
      </main>

      <Footer />
    </div>
  );
}
