import { apiRequest } from '../client';
import {
  currencyConversionOutSchema,
  currencyRateOutSchema,
} from '../schemas/currency';
import {
  CurrencyConversionOut,
  CurrencyRateOut,
  CurrencyRateCreate,
} from '../types';

/**
 * Currency Exchange Endpoints API helper
 */
export const currencyApi = {
  /**
   * Perform currency conversion from one currency to another.
   * Note: The query params are 'from', 'to', and 'amount'.
   */
  async convert(params: { from: string; to: string; amount: number }): Promise<CurrencyConversionOut> {
    return apiRequest<CurrencyConversionOut>(
      {
        url: '/currencies/convert',
        method: 'GET',
        params,
      },
      currencyConversionOutSchema
    );
  },

  /**
   * Retrieve list of all supported 3-letter currency codes.
   */
  async getSupported(): Promise<string[]> {
    return apiRequest<string[]>({
      url: '/currencies/supported',
      method: 'GET',
    });
  },

  /**
   * Retrieve map of currency codes to their full names (e.g. { "USD": "United States Dollar" }).
   */
  async getSymbols(): Promise<Record<string, string>> {
    return apiRequest<Record<string, string>>({
      url: '/currencies/symbols',
      method: 'GET',
    });
  },

  /**
   * Retrieve list of all current exchange rates in the database.
   */
  async getAllRates(): Promise<CurrencyRateOut[]> {
    const listSchema = currencyRateOutSchema.array();
    return apiRequest<CurrencyRateOut[]>(
      {
        url: '/currencies/rates',
        method: 'GET',
      },
      listSchema
    );
  },

  /**
   * Retrieve exchange rate for a specific currency pair.
   */
  async getRate(base: string, target: string): Promise<CurrencyRateOut> {
    return apiRequest<CurrencyRateOut>(
      {
        url: `/currencies/rates/${base}/${target}`,
        method: 'GET',
      },
      currencyRateOutSchema
    );
  },

  /**
   * Create or update a currency exchange rate (admin/protected).
   */
  async updateRate(data: CurrencyRateCreate): Promise<CurrencyRateOut> {
    return apiRequest<CurrencyRateOut>(
      {
        url: '/currencies/rates',
        method: 'POST',
        data,
      },
      currencyRateOutSchema
    );
  },
};
