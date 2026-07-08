import { apiRequest } from '../client';
import { userOutSchema } from '../schemas/auth';
import {
  UserOut,
  UserProfileUpdate,
  UserPasswordChange,
} from '../types';

/**
 * User Operations Endpoints API helper
 */
export const usersApi = {
  /**
   * Get current authenticated user details.
   */
  async getMe(): Promise<UserOut> {
    return apiRequest<UserOut>(
      {
        url: '/users/me',
        method: 'GET',
      },
      userOutSchema
    );
  },

  /**
   * Update basic profile details (email, first name, last name).
   */
  async updateProfile(data: UserProfileUpdate): Promise<UserOut> {
    return apiRequest<UserOut>(
      {
        url: '/users/me',
        method: 'PUT',
        data,
      },
      userOutSchema
    );
  },

  /**
   * Change current user password.
   * On success, active sessions are revoked.
   */
  async changePassword(data: UserPasswordChange): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>({
      url: '/users/me/password',
      method: 'PUT',
      data,
    });
  },

  /**
   * Soft-delete user account.
   */
  async deleteAccount(): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>({
      url: '/users/me',
      method: 'DELETE',
    });
  },
};
