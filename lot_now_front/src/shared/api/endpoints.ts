import { apiClient } from './client';
import { AUTH_ENDPOINTS, LOTS_ENDPOINTS, USERS_ENDPOINTS } from './config';
import type {
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
  User,
  Lot,
  LotDetail,
  CreateLotPayload,
  UpdateLotPayload,
  UpdateUserPayload,
  Bid,
  UploadImageResponse,
} from '../types/api';

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiClient.post<RegisterResponse>(AUTH_ENDPOINTS.register, payload, {
      auth: false,
    }),
  login: (payload: { email: string; password: string }) =>
    apiClient.post<LoginResponse>(AUTH_ENDPOINTS.login, payload, {
      auth: false,
    }),
  me: () => apiClient.get<User>(AUTH_ENDPOINTS.me),
  updateMe: (payload: UpdateUserPayload) =>
    apiClient.patch<User>(AUTH_ENDPOINTS.updateMe, payload),
  uploadAvatar: (file: File) =>
    apiClient.upload<UploadImageResponse>(AUTH_ENDPOINTS.uploadAvatar, file),
};

export const lotsApi = {
  list: (params?: { status_filter?: string }) => {
    const qs = params?.status_filter
      ? `?status_filter=${encodeURIComponent(params.status_filter)}`
      : '';
    return apiClient.get<Lot[]>(`${LOTS_ENDPOINTS.list}${qs}`, {
      auth: true,
    });
  },
  detail: (id: number | string) =>
    apiClient.get<LotDetail>(LOTS_ENDPOINTS.detail(id), { auth: true }),
  create: (payload: CreateLotPayload) =>
    apiClient.post<Lot>(LOTS_ENDPOINTS.create, payload),
  update: (id: number | string, payload: UpdateLotPayload) =>
    apiClient.patch<Lot>(LOTS_ENDPOINTS.update(id), payload),
  publish: (id: number | string) =>
    apiClient.patch<Lot>(LOTS_ENDPOINTS.publish(id), {}),
  uploadImage: (id: number | string, file: File) =>
    apiClient.upload<UploadImageResponse>(LOTS_ENDPOINTS.uploadImage(id), file),
};

export const bidsApi = {
  myBids: () => apiClient.get<Bid[]>(USERS_ENDPOINTS.myBids),
};
