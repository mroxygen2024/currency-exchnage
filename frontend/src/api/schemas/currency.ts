import { z } from 'zod';

export const currencyRateBaseSchema = z.object({
  base_currency: z.string().length(3),
  target_currency: z.string().length(3),
  rate: z.number().positive(),
});

export const currencyRateCreateSchema = currencyRateBaseSchema;

export const currencyRateUpdateSchema = z.object({
  rate: z.number().positive(),
});

export const currencyRateOutSchema = currencyRateBaseSchema.extend({
  id: z.number(),
  last_updated: z.coerce.date(),
});

export const currencyConversionOutSchema = z.object({
  id: z.number(),
  user_id: z.number().nullable().optional(),
  from_currency: z.string().length(3),
  to_currency: z.string().length(3),
  amount: z.number().positive(),
  rate: z.number().positive(),
  result: z.number(),
  converted_at: z.coerce.date(),
});

export const paginatedHistorySchema = z.object({
  items: z.array(currencyConversionOutSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  pages: z.number().int().nonnegative(),
});

export const analyticsPairSchema = z.object({
  from_currency: z.string(),
  to_currency: z.string(),
  count: z.number().int().nonnegative(),
  total_amount: z.number().nonnegative(),
});

export const currencyAnalyticsOutSchema = z.object({
  total_conversions: z.number().int().nonnegative(),
  popular_pairs: z.array(analyticsPairSchema),
  total_volume_by_currency: z.record(z.string(), z.number().nonnegative()),
});

export const trendItemSchema = z.object({
  rate: z.number(),
  timestamp: z.coerce.date(),
});

export const trendStatsSchema = z.object({
  average_rate: z.number(),
  percentage_change: z.number(),
  min_rate: z.number(),
  max_rate: z.number(),
});

export const currencyTrendsOutSchema = z.object({
  base_currency: z.string().length(3),
  target_currency: z.string().length(3),
  trends: z.array(trendItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  pages: z.number().int().nonnegative(),
  stats: trendStatsSchema,
});

export const supportedCurrenciesSchema = z.array(z.string());
export const currencySymbolsSchema = z.record(z.string(), z.string());

