'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/src/features/auth/AuthProvider';
import { Header } from '@/src/shared/components/Header';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 15_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <div className="flex min-h-screen flex-col">
          <Header />
          <div className="flex-1">{children}</div>
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}
