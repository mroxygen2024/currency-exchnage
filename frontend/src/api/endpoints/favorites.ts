import { apiRequest } from '../client';
import { favoritePairOutSchema } from '../schemas/favorites';
import { FavoritePairCreate, FavoritePairOut } from '../types';

/**
 * Favorite Currency Pairs Endpoints API helper
 */
export const favoritesApi = {
  /**
   * Add a currency pair to the user's favorites.
   */
  async addFavorite(data: FavoritePairCreate): Promise<FavoritePairOut> {
    return apiRequest<FavoritePairOut>(
      {
        url: '/favorites',
        method: 'POST',
        data,
      },
      favoritePairOutSchema
    );
  },

  /**
   * Retrieve all favorite currency pairs for the logged-in user.
   */
  async getFavorites(): Promise<FavoritePairOut[]> {
    const listSchema = favoritePairOutSchema.array();
    return apiRequest<FavoritePairOut[]>(
      {
        url: '/favorites',
        method: 'GET',
      },
      listSchema
    );
  },

  /**
   * Remove a favorite currency pair.
   */
  async deleteFavorite(favoriteId: number): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>({
      url: `/favorites/${favoriteId}`,
      method: 'DELETE',
    });
  },
};
