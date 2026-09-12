'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/src/shared/api/endpoints';
import { getToken, setToken, setUnauthorizedHandler } from '@/src/shared/api/client';
import type { User, LoginResponse, RegisterPayload } from '@/src/shared/types/api';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refetchUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadUser = useCallback(async (): Promise<User | null> => {
    const token = getToken();
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const me = await authApi.me();
      setUser(me);
      return me;
    } catch {
      setToken(null);
      setUser(null);
      return null;
    }
  }, []);

  // Initialise session from persisted token, and wire the 401 handler.
  useEffect(() => {
    let active = true;
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace('/login');
    });
    loadUser().finally(() => {
      if (active) setIsInitialized(true);
    });
    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, [loadUser, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token }: LoginResponse = await authApi.login({ email, password });
      setToken(access_token);
      const me = await authApi.me();
      setUser(me);
    },
    [],
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    await authApi.register(payload);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isInitialized,
      login,
      register,
      logout,
      refetchUser: loadUser,
    }),
    [user, isInitialized, login, register, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
