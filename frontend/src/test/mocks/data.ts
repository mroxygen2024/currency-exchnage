export const mockUser = {
  id: 1,
  email: 'test@example.com',
  is_active: true,
  first_name: 'Jane',
  last_name: 'Doe',
  role: 'user',
  is_deleted: false,
};

export const mockToken = {
  access_token: 'mock.access.token.eyJhbGciOiJIUzI1NiJ9',
  refresh_token: 'rt_mock_refresh_token_secure',
  token_type: 'bearer',
};

export const mockRates = [
  { id: 1, base_currency: 'USD', target_currency: 'EUR', rate: 0.92, last_updated: new Date().toISOString() },
  { id: 2, base_currency: 'EUR', target_currency: 'USD', rate: 1.087, last_updated: new Date().toISOString() },
  { id: 3, base_currency: 'GBP', target_currency: 'USD', rate: 1.28, last_updated: new Date().toISOString() },
];

export const mockConversion = {
  id: 1,
  user_id: 1,
  from_currency: 'USD',
  to_currency: 'EUR',
  amount: 1000,
  rate: 0.92,
  result: 920,
  converted_at: new Date().toISOString(),
};

export const mockHistory = {
  items: [
    {
      id: 1,
      user_id: 1,
      from_currency: 'USD',
      to_currency: 'EUR',
      amount: 1000,
      rate: 0.92,
      result: 920,
      converted_at: new Date().toISOString(),
    },
    {
      id: 2,
      user_id: 1,
      from_currency: 'EUR',
      to_currency: 'GBP',
      amount: 500,
      rate: 0.85,
      result: 425,
      converted_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
  total: 2,
  page: 1,
  limit: 10,
  pages: 1,
};

export const mockFavorites = [
  { id: 1, user_id: 1, base_currency: 'USD', target_currency: 'EUR', created_at: new Date().toISOString() },
  { id: 2, user_id: 1, base_currency: 'GBP', target_currency: 'JPY', created_at: new Date().toISOString() },
];

export const mockNotifications = [
  {
    id: 1,
    user_id: 1,
    base_currency: 'USD',
    target_currency: 'EUR',
    threshold: 0.95,
    condition: 'above',
    is_active: true,
    last_triggered_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const mockAnalytics = {
  total_conversions: 42,
  popular_pairs: [
    { from_currency: 'USD', to_currency: 'EUR', count: 20, total_amount: 50000 },
    { from_currency: 'EUR', to_currency: 'GBP', count: 12, total_amount: 30000 },
  ],
  total_volume_by_currency: { USD: 80000, EUR: 50000, GBP: 30000 },
};

export const mockTrends = {
  base_currency: 'USD',
  target_currency: 'EUR',
  trends: [
    { rate: 0.91, timestamp: new Date(Date.now() - 86400000).toISOString() },
    { rate: 0.92, timestamp: new Date().toISOString() },
  ],
  total: 2,
  page: 1,
  limit: 30,
  pages: 1,
  stats: {
    average_rate: 0.915,
    percentage_change: 1.1,
    min_rate: 0.91,
    max_rate: 0.92,
  },
};
