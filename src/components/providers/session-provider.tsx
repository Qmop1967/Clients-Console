"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { SessionRecovery } from "./session-recovery";

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider
      // Re-check session when PWA returns to foreground
      refetchOnWindowFocus={true}
      // Also poll every 5 minutes as safety net
      refetchInterval={5 * 60}
    >
      <SessionRecovery />
      {children}
    </NextAuthSessionProvider>
  );
}
