import { apiRequest } from '../client';
import {
  paginatedHistorySchema,
  currencyConversionOutSchema,
} from '../schemas/currency';
import {
  PaginatedHistory,
  CurrencyConversionOut,
} from '../types';
import { formatDateQueryParams } from '../helpers';

export interface HistoryFilterParams {
  page?: number;
  limit?: number;
  start_date?: Date | string;
  end_date?: Date | string;
  from_currency?: string;
  to_currency?: string;
  sort_by?: 'converted_at' | 'amount' | 'rate' | 'result';
  sort_order?: 'asc' | 'desc';
  user_id?: number; // Admin only
}

export interface HistoryExportParams {
  start_date?: Date | string;
  end_date?: Date | string;
  from_currency?: string;
  to_currency?: string;
  user_id?: number; // Admin only
}

/**
 * Conversion History Endpoints API helper
 */
export const historyApi = {
  /**
   * Retrieve list of historical conversions with filtering and sorting.
   */
  async getHistory(params?: HistoryFilterParams): Promise<PaginatedHistory> {
    const formattedParams = formatDateQueryParams(params);

    return apiRequest<PaginatedHistory>(
      {
        url: '/history',
        method: 'GET',
        params: formattedParams,
      },
      paginatedHistorySchema
    );
  },

  /**
   * Export conversion history as a CSV Blob.
   */
  async exportHistory(params?: HistoryExportParams): Promise<Blob> {
    const formattedParams = formatDateQueryParams(params);

    return apiRequest<Blob>({
      url: '/history/export',
      method: 'GET',
      params: formattedParams,
      responseType: 'blob',
    });
  },

  /**
   * Get detail of a specific conversion record.
   */
  async getRecord(id: number): Promise<CurrencyConversionOut> {
    return apiRequest<CurrencyConversionOut>(
      {
        url: `/history/${id}`,
        method: 'GET',
      },
      currencyConversionOutSchema
    );
  },

  /**
   * Delete a specific conversion record from history (soft or hard depending on DB).
   */
  async deleteRecord(id: number): Promise<void> {
    return apiRequest<void>({
      url: `/history/${id}`,
      method: 'DELETE',
    });
  },
};
