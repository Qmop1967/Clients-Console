"use client";

import { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { CartProvider } from "./cart-provider";

/**
 * CartSessionProvider - Wraps CartProvider with session-aware currency
 *
 * This component makes the cart currency reactive to the user's session:
 * - Authenticated users: Use their currencyCode from session (USD, IQD, etc.)
 * - Public visitors: Default to IQD (Consumer pricing)
 *
 * This ensures that when a user logs in/out, the cart currency updates automatically.
 */
export function CartSessionProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  // Default to IQD for public visitors, use session currency for authenticated users
  const currencyCode = status === "authenticated" && session?.user?.currencyCode
    ? session.user.currencyCode
    : "IQD";

  return (
    <CartProvider currencyCode={currencyCode}>
      {children}
    </CartProvider>
  );
}
