// Centralized runtime configuration. Backend base URL lives in env.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8001';

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ?? 'ws://localhost:8001';

export const TOKEN_STORAGE_KEY = 'lotnow.access_token';

export const AUTH_ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  me: '/auth/me',
  updateMe: '/auth/me',
  uploadAvatar: '/auth/me/avatar',
} as const;

export const LOTS_ENDPOINTS = {
  list: '/lots/',
  detail: (id: number | string) => `/lots/${id}`,
  create: '/lots/',
  update: (id: number | string) => `/lots/${id}`,
  publish: (id: number | string) => `/lots/${id}/publish`,
  uploadImage: (id: number | string) => `/lots/${id}`,
} as const;

export const USERS_ENDPOINTS = {
  myBids: '/users/me/bids',
} as const;
