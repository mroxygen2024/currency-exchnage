import { http, HttpResponse } from 'msw';
import { mockUser, mockToken, mockRates, mockConversion, mockHistory, mockFavorites, mockNotifications, mockAnalytics, mockTrends } from './data';

const API_BASE = 'http://localhost:8000/api/v1';

export const handlers = [
  // Auth
  http.post(`${API_BASE}/auth/register`, () => {
    return HttpResponse.json(mockUser, { status: 201 });
  }),

  http.post(`${API_BASE}/auth/login`, () => {
    return HttpResponse.json(mockToken);
  }),

  http.post(`${API_BASE}/auth/refresh`, () => {
    return HttpResponse.json(mockToken);
  }),

  http.post(`${API_BASE}/auth/logout`, () => {
    return HttpResponse.json({ success: true, message: 'Logged out' });
  }),

  http.get(`${API_BASE}/auth/me`, () => {
    return HttpResponse.json(mockUser);
  }),

  // Users
  http.get(`${API_BASE}/users/me`, () => {
    return HttpResponse.json(mockUser);
  }),

  http.put(`${API_BASE}/users/me`, () => {
    return HttpResponse.json(mockUser);
  }),

  http.put(`${API_BASE}/users/me/password`, () => {
    return HttpResponse.json({ success: true, message: 'Password updated' });
  }),

  http.delete(`${API_BASE}/users/me`, () => {
    return HttpResponse.json({ success: true, message: 'Account deleted' });
  }),

  // Currency
  http.get(`${API_BASE}/currencies/convert`, () => {
    return HttpResponse.json(mockConversion);
  }),

  http.get(`${API_BASE}/currencies/supported`, () => {
    return HttpResponse.json(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF']);
  }),

  http.get(`${API_BASE}/currencies/symbols`, () => {
    return HttpResponse.json({
      USD: 'United States Dollar',
      EUR: 'Euro',
      GBP: 'British Pound',
      JPY: 'Japanese Yen',
      CAD: 'Canadian Dollar',
      AUD: 'Australian Dollar',
      CHF: 'Swiss Franc',
    });
  }),

  http.get(`${API_BASE}/currencies/rates`, () => {
    return HttpResponse.json(mockRates);
  }),

  http.get(`${API_BASE}/currencies/rates/:base/:target`, ({ params }) => {
    const base = (params.base as string).toUpperCase();
    const target = (params.target as string).toUpperCase();
    return HttpResponse.json({
      id: 1,
      base_currency: base,
      target_currency: target,
      rate: 0.92,
      last_updated: new Date().toISOString(),
    });
  }),

  http.post(`${API_BASE}/currencies/rates`, () => {
    return HttpResponse.json(mockRates[0], { status: 201 });
  }),

  // History
  http.get(`${API_BASE}/history`, () => {
    return HttpResponse.json(mockHistory);
  }),

  http.get(`${API_BASE}/history/:id`, ({ params }) => {
    const id = Number(params.id);
    const item = mockHistory.items.find((h) => h.id === id) ?? mockHistory.items[0];
    return HttpResponse.json(item);
  }),

  http.delete(`${API_BASE}/history/:id`, () => {
    return HttpResponse.json({ success: true, message: 'Deleted' });
  }),

  // Favorites
  http.get(`${API_BASE}/favorites`, () => {
    return HttpResponse.json(mockFavorites);
  }),

  http.post(`${API_BASE}/favorites`, () => {
    return HttpResponse.json(mockFavorites[0], { status: 201 });
  }),

  http.delete(`${API_BASE}/favorites/:id`, () => {
    return HttpResponse.json({ success: true, message: 'Removed' });
  }),

  // Notifications
  http.get(`${API_BASE}/notifications`, () => {
    return HttpResponse.json(mockNotifications);
  }),

  http.post(`${API_BASE}/notifications/subscribe`, () => {
    return HttpResponse.json(mockNotifications[0], { status: 201 });
  }),

  http.delete(`${API_BASE}/notifications/:id`, () => {
    return HttpResponse.json({ success: true, message: 'Deleted' });
  }),

  // Analytics
  http.get(`${API_BASE}/currencies/analytics`, () => {
    return HttpResponse.json(mockAnalytics);
  }),

  http.get(`${API_BASE}/analytics/trends`, () => {
    return HttpResponse.json(mockTrends);
  }),

  // Health
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({ status: 'healthy' });
  }),

  // Catch-all for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`[MSW] Unhandled request: ${request.method} ${request.url}`);
    return HttpResponse.json({ error: 'Not found' }, { status: 404 });
  }),
];
