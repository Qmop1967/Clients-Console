"use client";

/**
 * SessionRecovery — iOS PWA cookie persistence fix
 * 
 * Problem: iOS clears HttpOnly cookies when PWA is closed/backgrounded,
 * destroying the NextAuth session.
 * 
 * Solution: After login, we store recovery credentials in localStorage
 * (which iOS does NOT clear). On app reopen, if the session cookie is
 * gone but localStorage has valid recovery data, we silently re-sign-in
 * via NextAuth's Credentials provider — no OTP needed, no user action.
 * 
 * Security: recovery data contains phone/email + partnerId, same info
 * the user already provided. The signIn() call goes through the normal
 * NextAuth authorize() which validates against Odoo.
 */

import { useSession, signIn } from "next-auth/react";
import { useEffect, useRef } from "react";

export const RECOVERY_KEY = "tsh_session_recovery";
const RECOVERY_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

export function SessionRecovery() {
  const { status } = useSession();
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Only act when NextAuth confirms no session AND we haven't tried yet
    if (status !== "unauthenticated" || attemptedRef.current) return;

    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return;

    let data: { method?: string; phone?: string; email?: string; partnerId?: string; ts?: number };
    try {
      data = JSON.parse(raw);
    } catch {
      localStorage.removeItem(RECOVERY_KEY);
      return;
    }

    // Expired recovery data
    if (!data.ts || Date.now() - data.ts > RECOVERY_MAX_AGE_MS) {
      localStorage.removeItem(RECOVERY_KEY);
      return;
    }

    // Must have phone or email+partnerId
    if (!data.phone && !data.email) {
      localStorage.removeItem(RECOVERY_KEY);
      return;
    }

    attemptedRef.current = true;

    const recover = async () => {
      try {
        console.log("[SessionRecovery] Attempting silent re-login...");

        const result =
          data.method === "email" && data.email && data.partnerId
            ? await signIn("email", {
                email: data.email,
                partnerId: data.partnerId,
                redirect: false,
              })
            : data.phone
              ? await signIn("phone", {
                  phone: data.phone,
                  redirect: false,
                })
              : null;

        if (!result || result.error) {
          console.warn("[SessionRecovery] Recovery failed, clearing data");
          localStorage.removeItem(RECOVERY_KEY);
          return;
        }

        console.log("[SessionRecovery] Session restored successfully");
        // Refresh the page to pick up the new session cookie
        window.location.reload();
      } catch (err) {
        console.error("[SessionRecovery] Error:", err);
        localStorage.removeItem(RECOVERY_KEY);
      }
    };

    recover();
  }, [status]);

  return null;
}
