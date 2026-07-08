import { apiRequest } from '../client';
import { healthCheckOutSchema } from '../schemas/health';
import { HealthCheckOut } from '../types';

/**
 * Health Endpoints API helper
 */
export const healthApi = {
  /**
   * Check application health status (database and cache connectivity).
   */
  async checkHealth(): Promise<HealthCheckOut> {
    return apiRequest<HealthCheckOut>(
      {
        url: '/health',
        method: 'GET',
        skipAuth: true,
      },
      healthCheckOutSchema
    );
  },
};
