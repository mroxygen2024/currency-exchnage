// Core Client and Utilities
export { default as apiClient, apiRequest } from './client';
export { API_CONFIG } from './config';
export { tokenStorage } from './storage';
export {
	normalizeQueryParams,
	formatDateQueryParams,
	toIsoString,
	dispatchSessionExpiredEvent,
} from './helpers';
export { ApiError, parseApiError, type ApiValidationError } from './errors';

// Endpoint Helpers
export { authApi } from './endpoints/auth';
export { usersApi } from './endpoints/users';
export { currencyApi } from './endpoints/currency';
export { historyApi, type HistoryFilterParams, type HistoryExportParams } from './endpoints/history';
export { favoritesApi } from './endpoints/favorites';
export { notificationsApi } from './endpoints/notifications';
export { analyticsApi } from './endpoints/analytics';
export { healthApi } from './endpoints/health';

// Zod Validation Schemas
export * as authSchemas from './schemas/auth';
export * as userSchemas from './schemas/users';
export * as currencySchemas from './schemas/currency';
export * as favoriteSchemas from './schemas/favorites';
export * as notificationSchemas from './schemas/notifications';
export * as healthSchemas from './schemas/health';

// Inferred TypeScript Types
export type * from './types';
