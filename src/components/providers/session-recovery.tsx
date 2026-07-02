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

    let data: { recoveryToken?: string; method?: string; phone?: string; email?: string; partnerId?: string; ts?: number };
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

    // SECURITY 2026-07-02: legacy blobs stored the raw phone/email (no token).
    // Those can no longer silently re-login (the whole point of the fix). Clear
    // them so the user logs in once; from then on they hold a rotating token.
    if (!data.recoveryToken) {
      localStorage.removeItem(RECOVERY_KEY);
      return;
    }

    attemptedRef.current = true;

    const recover = async () => {
      try {
        console.log("[SessionRecovery] Attempting silent re-login...");

        // SECURITY 2026-07-02: exchange the rotating recovery token for a
        // fresh single-use auth ticket. The server rotates the token each time.
        const rec = await fetch("/api/auth/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recoveryToken: data.recoveryToken }),
        });
        if (!rec.ok) {
          console.warn("[SessionRecovery] Token rejected, clearing");
          localStorage.removeItem(RECOVERY_KEY);
          return;
        }
        const rj = await rec.json();

        // Persist the rotated token before signIn so a reload can't replay the old one.
        try {
          localStorage.setItem(RECOVERY_KEY, JSON.stringify({
            recoveryToken: rj.recoveryToken || "",
            ts: Date.now(),
          }));
        } catch { /* non-critical */ }

        const result =
          rj.method === "email" && rj.partnerId
            ? await signIn("email", {
                email: rj.email || "",
                partnerId: String(rj.partnerId),
                ticket: rj.ticket,
                redirect: false,
              })
            : rj.phone
              ? await signIn("phone", {
                  phone: rj.phone,
                  ticket: rj.ticket,
                  redirect: false,
                })
              : null;

        if (!result || result.error) {
          console.warn("[SessionRecovery] Recovery failed, clearing data");
          localStorage.removeItem(RECOVERY_KEY);
          return;
        }

        console.log("[SessionRecovery] Session restored successfully");
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
