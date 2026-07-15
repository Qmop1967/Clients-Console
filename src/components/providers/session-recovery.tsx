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
export const LOGIN_PREFILL_KEY = "tsh_login_prefill";
const RECOVERY_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

// One-time hint so the login screen can explain WHY the user was signed out and
// pre-fill their identity. Written just before a recovery blob is wiped because
// it can no longer silently re-login (legacy raw-phone blob, or a
// rejected/expired rotating token). Security behavior is unchanged — we still
// wipe; we only leave a breadcrumb for a friendlier re-auth.
function writeLoginPrefill(data: { method?: string; email?: string; phone?: string }) {
  try {
    if (!data.email && !data.phone) return;
    localStorage.setItem(
      LOGIN_PREFILL_KEY,
      JSON.stringify({
        method: data.method === "email" ? "email" : data.phone ? "phone" : data.method || "",
        email: data.email || undefined,
        phone: data.phone || undefined,
        reason: "security_reauth",
        ts: Date.now(),
      })
    );
  } catch {
    /* non-critical */
  }
}

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
      writeLoginPrefill(data);
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
          writeLoginPrefill(data);
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
          writeLoginPrefill({ method: rj.method, email: rj.email, phone: rj.phone });
          localStorage.removeItem(RECOVERY_KEY);
          return;
        }

        console.log("[SessionRecovery] Session restored successfully");
        // UX 2026-07-15: a blind reload on the login screen re-renders the OTP
        // form for a user whose session was JUST restored — the exact "why am I
        // asked to log in again?!" complaint. Navigate into the app instead.
        const path = window.location.pathname;
        if (/\/login(\/|$)/.test(path)) {
          const loc = path.split("/")[1] || "ar";
          let target = `/${loc}/dashboard`;
          try {
            const cb = new URLSearchParams(window.location.search).get("callbackUrl") || "";
            if (cb.startsWith("/") && !cb.startsWith("//")) target = cb;
          } catch { /* ignore */ }
          window.location.href = target;
        } else {
          window.location.reload();
        }
      } catch (err) {
        console.error("[SessionRecovery] Error:", err);
        localStorage.removeItem(RECOVERY_KEY);
      }
    };

    recover();
  }, [status]);

  return null;
}
