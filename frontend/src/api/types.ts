import { z } from 'zod';
import * as authSchemas from './schemas/auth';
import * as userSchemas from './schemas/users';
import * as currencySchemas from './schemas/currency';
import * as favoriteSchemas from './schemas/favorites';
import * as notificationSchemas from './schemas/notifications';
import * as healthSchemas from './schemas/health';

export interface ApiSuccessResponse<T> {
	data: T;
}

export interface ApiMessageResponse {
	success: boolean;
	message: string;
}

export type ApiListResponse<T> = T[];

// --- Auth Types ---
export type UserOut = z.infer<typeof authSchemas.userOutSchema>;
export type Token = z.infer<typeof authSchemas.tokenSchema>;
export type TokenPayload = z.infer<typeof authSchemas.tokenPayloadSchema>;
export type RegisterRequest = z.infer<typeof authSchemas.registerRequestSchema>;
export type LoginRequest = z.infer<typeof authSchemas.loginRequestSchema>;

// --- User Types ---
export type UserProfileUpdate = z.infer<typeof userSchemas.userProfileUpdateSchema>;
export type UserPasswordChange = z.infer<typeof userSchemas.userPasswordChangeSchema>;

// --- Currency Types ---
export type CurrencyRateBase = z.infer<typeof currencySchemas.currencyRateBaseSchema>;
export type CurrencyRateCreate = z.infer<typeof currencySchemas.currencyRateCreateSchema>;
export type CurrencyRateUpdate = z.infer<typeof currencySchemas.currencyRateUpdateSchema>;
export type CurrencyRateOut = z.infer<typeof currencySchemas.currencyRateOutSchema>;
export type CurrencyConversionOut = z.infer<typeof currencySchemas.currencyConversionOutSchema>;
export type PaginatedHistory = z.infer<typeof currencySchemas.paginatedHistorySchema>;
export type AnalyticsPair = z.infer<typeof currencySchemas.analyticsPairSchema>;
export type CurrencyAnalyticsOut = z.infer<typeof currencySchemas.currencyAnalyticsOutSchema>;
export type TrendItem = z.infer<typeof currencySchemas.trendItemSchema>;
export type TrendStats = z.infer<typeof currencySchemas.trendStatsSchema>;
export type CurrencyTrendsOut = z.infer<typeof currencySchemas.currencyTrendsOutSchema>;
export type SupportedCurrencies = z.infer<typeof currencySchemas.supportedCurrenciesSchema>;
export type CurrencySymbols = z.infer<typeof currencySchemas.currencySymbolsSchema>;

// --- Favorite Types ---
export type FavoritePairCreate = z.infer<typeof favoriteSchemas.favoritePairCreateSchema>;
export type FavoritePairOut = z.infer<typeof favoriteSchemas.favoritePairOutSchema>;

// --- Notification/Alert Types ---
export type NotificationSubscriptionCreate = z.infer<typeof notificationSchemas.notificationSubscriptionCreateSchema>;
export type NotificationSubscriptionOut = z.infer<typeof notificationSchemas.notificationSubscriptionOutSchema>;

// --- Health Types ---
export type HealthCheckOut = z.infer<typeof healthSchemas.healthCheckOutSchema>;
