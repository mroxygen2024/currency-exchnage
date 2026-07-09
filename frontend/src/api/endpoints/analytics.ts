import { apiRequest } from '../client';
import {
  currencyAnalyticsOutSchema,
  currencyTrendsOutSchema,
} from '../schemas/currency';
import {
  CurrencyAnalyticsOut,
  CurrencyTrendsOut,
} from '../types';
import { formatDateQueryParams } from '../helpers';

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
    const formattedParams = formatDateQueryParams(params);

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
