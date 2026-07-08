import { apiRequest } from '../client';
import {
  currencyAnalyticsOutSchema,
  currencyTrendsOutSchema,
} from '../schemas/currency';
import {
  CurrencyAnalyticsOut,
  CurrencyTrendsOut,
} from '../types';

export interface TrendFilterParams {
  base: string;
  target: string;
  start_date?: Date | string;
  end_date?: Date | string;
  page?: number;
  limit?: number;
}

/**
 * Analytics and Trends Endpoints API helper
 */
export const analyticsApi = {
  /**
   * Retrieve system-wide currency metrics (popular pairs, conversion volumes).
   */
  async getSystemAnalytics(): Promise<CurrencyAnalyticsOut> {
    return apiRequest<CurrencyAnalyticsOut>(
      {
        url: '/currencies/analytics',
        method: 'GET',
      },
      currencyAnalyticsOutSchema
    );
  },

  /**
   * Retrieve historical exchange rate trends and statistics for a currency pair.
   */
  async getTrends(params: TrendFilterParams): Promise<CurrencyTrendsOut> {
    const formattedParams = { ...params };
    if (params.start_date instanceof Date) {
      formattedParams.start_date = params.start_date.toISOString();
    }
    if (params.end_date instanceof Date) {
      formattedParams.end_date = params.end_date.toISOString();
    }

    return apiRequest<CurrencyTrendsOut>(
      {
        url: '/analytics/trends',
        method: 'GET',
        params: formattedParams,
      },
      currencyTrendsOutSchema
    );
  },
};
