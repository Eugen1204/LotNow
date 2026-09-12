import { API_BASE_URL, TOKEN_STORAGE_KEY } from './config';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Название',
  description: 'Описание',
  start_price: 'Стартовая цена',
  min_step: 'Минимальный шаг',
  start_time: 'Начало торгов',
  end_time: 'Окончание торгов',
  image_url: 'Изображение',
  username: 'Имя пользователя',
  email: 'Email',
  password: 'Пароль',
  bio: 'О себе',
  avatar_url: 'Аватар',
  amount: 'Сумма ставки',
};

const PYDANTIC_TYPE_MESSAGES: Record<string, string> = {
  string_too_short: 'значение слишком короткое',
  string_too_long: 'значение слишком длинное',
  missing: 'поле обязательно',
  value_error: 'недопустимое значение',
  'value_error.missing': 'поле обязательно',
  type_error: 'недопустимый тип значения',
  int_parsing: 'ожидается целое число',
  float_parsing: 'ожидается число',
  greater_than_equal: 'значение слишком маленькое',
  less_than_equal: 'значение слишком большое',
  greater_than: 'значение слишком маленькое',
  less_than: 'значение слишком большое',
};

function formatPydanticDetail(detail: unknown): string {
  if (!Array.isArray(detail)) {
    return typeof detail === 'string' ? detail : JSON.stringify(detail);
  }
  const messages = detail.map((item) => {
    if (typeof item !== 'object' || item === null) return String(item);
    const obj = item as Record<string, unknown>;
    const loc = Array.isArray(obj.loc) ? obj.loc : [];
    const fieldName = loc.length > 0 ? String(loc[loc.length - 1]) : '';
    const fieldLabel = FIELD_LABELS[fieldName] ?? fieldName;
    const type = typeof obj.type === 'string' ? obj.type : '';
    const msg = typeof obj.msg === 'string' ? obj.msg : '';
    const mapped = type ? PYDANTIC_TYPE_MESSAGES[type] : undefined;
    const humanMsg = mapped ?? msg;
    return fieldLabel ? `${fieldLabel}: ${humanMsg}` : humanMsg;
  });
  return messages.join('; ');
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, headers, ...rest } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Clear token and trigger centralized session reset.
    setToken(null);
    unauthorizedHandler?.();
    throw new ApiErrorImpl('Unauthorized', 401);
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) {
        detail = formatPydanticDetail(data.detail);
      }
    } catch {
      // not json, fall through with default detail
    }
    throw new ApiErrorImpl(detail, res.status);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return (await res.text()) as unknown as T;
  }
  return (await res.json()) as T;
}

export class ApiErrorImpl extends Error {
  status: number;
  constructor(detail: string, status: number) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function uploadFile<T>(
  path: string,
  file: File,
  fieldName: string,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const formData = new FormData();
  formData.append(fieldName, file);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) {
    setToken(null);
    unauthorizedHandler?.();
    throw new ApiErrorImpl('Unauthorized', 401);
  }

  if (!res.ok) {
    let detail = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) {
        detail = formatPydanticDetail(data.detail);
      }
    } catch {
      // not json
    }
    throw new ApiErrorImpl(detail, res.status);
  }

  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
  upload: <T>(path: string, file: File, fieldName = 'file') =>
    uploadFile<T>(path, file, fieldName),
};
