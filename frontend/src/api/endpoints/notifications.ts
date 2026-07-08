import { apiRequest } from '../client';
import { notificationSubscriptionOutSchema } from '../schemas/notifications';
import {
  NotificationSubscriptionCreate,
  NotificationSubscriptionOut,
} from '../types';

/**
 * Currency Alerts / Notifications Endpoints API helper
 */
export const notificationsApi = {
  /**
   * Subscribe to a new currency threshold alert.
   */
  async subscribe(data: NotificationSubscriptionCreate): Promise<NotificationSubscriptionOut> {
    return apiRequest<NotificationSubscriptionOut>(
      {
        url: '/notifications/subscribe',
        method: 'POST',
        data,
      },
      notificationSubscriptionOutSchema
    );
  },

  /**
   * Retrieve all active alert subscriptions for the logged-in user.
   */
  async getSubscriptions(): Promise<NotificationSubscriptionOut[]> {
    const listSchema = notificationSubscriptionOutSchema.array();
    return apiRequest<NotificationSubscriptionOut[]>(
      {
        url: '/notifications',
        method: 'GET',
      },
      listSchema
    );
  },

  /**
   * Delete/unsubscribe from a specific alert.
   */
  async deleteSubscription(subscriptionId: number): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>({
      url: `/notifications/${subscriptionId}`,
      method: 'DELETE',
    });
  },
};
