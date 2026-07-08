"use client";

/**
 * PasskeyEnrollCard — inline post-login prompt to register a platform passkey
 * (Face ID / Touch ID / fingerprint) so future logins are one touch.
 *
 * PWA rule: this is an INLINE card, never a modal/overlay (modals are banned in
 * TSH PWAs). It renders at the top of the dashboard and self-hides when the
 * passkey is unsupported, already registered, or recently dismissed.
 *
 * (Lives under dashboard/ rather than auth/ purely because auth/ is not
 * group-writable in this checkout; it is a dashboard-only client component.)
 *
 * Storage:
 *  - tsh_passkey_registered = "1"   → enrolled; card never shows again
 *  - tsh_passkey_email      = email → identity for the login-side passkey flow
 *  - tsh_passkey_prompt_dismissed = ts → "Later"; re-show only after 14 days
 */

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Fingerprint, Loader2, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  startRegistration,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";

const DISMISS_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function PasskeyEnrollCard({ email }: { email?: string | null }) {
  const locale = useLocale();
  const isAr = locale === "ar";

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // A synthetic placeholder email can't own a real passkey login — skip those.
  const cleanEmail = (email || "").trim().toLowerCase();
  const usableEmail = cleanEmail.includes("@") && !cleanEmail.endsWith("@tsh.local");

  useEffect(() => {
    // Feature flag: WebAuthn storage not wired yet (dummy Upstash) — flip after real store
    if (process.env.NEXT_PUBLIC_PASSKEY_ENABLED !== "1") return;
    if (!usableEmail) return;

    try {
      if (localStorage.getItem("tsh_passkey_registered") === "1") return;
      const dismissed = Number(localStorage.getItem("tsh_passkey_prompt_dismissed") || 0);
      if (dismissed && Date.now() - dismissed < DISMISS_WINDOW_MS) return;
    } catch {
      return;
    }

    (async () => {
      try {
        if (typeof window === "undefined" || !window.PublicKeyCredential) return;
        if (!browserSupportsWebAuthn()) return;
        const available = await platformAuthenticatorIsAvailable();
        if (available) setVisible(true);
      } catch { /* unsupported — stay hidden */ }
    })();
  }, [usableEmail]);

  const handleLater = () => {
    try { localStorage.setItem("tsh_passkey_prompt_dismissed", String(Date.now())); } catch { /* ignore */ }
    setVisible(false);
  };

  const handleEnable = async () => {
    setBusy(true);
    setError("");
    try {
      const optRes = await fetch("/api/auth/webauthn/register-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!optRes.ok) throw new Error("options_failed");
      const { options, challengeToken } = await optRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/auth/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: credential, challengeToken }),
      });
      const data = await verifyRes.json();
      if (!verifyRes.ok || !data?.verified) throw new Error("verify_failed");

      try {
        localStorage.setItem("tsh_passkey_registered", "1");
        localStorage.setItem("tsh_passkey_email", cleanEmail);
        localStorage.removeItem("tsh_passkey_prompt_dismissed");
      } catch { /* non-critical */ }

      setDone(true);
      setTimeout(() => setVisible(false), 2000);
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      // User cancelled the biometric prompt — quietly dismiss for now.
      if (name === "NotAllowedError" || name === "AbortError") {
        handleLater();
        return;
      }
      setError(isAr ? "تعذّر التفعيل. حاول مرة أخرى." : "Couldn't enable it. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gold-subtle bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm dark:border-amber-900/40 dark:from-amber-950/20 dark:to-transparent">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {done ? <CheckCircle2 className="h-6 w-6" /> : <Fingerprint className="h-6 w-6" />}
      </div>

      <div className="min-w-0 flex-1">
        {done ? (
          <p className="text-sm font-semibold text-foreground">
            {isAr ? "تم تفعيل الدخول بالبصمة" : "Passkey sign-in enabled"}
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">
              {isAr ? "فعّل الدخول بالبصمة" : "Enable passkey sign-in"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              {isAr ? "ادخل بلمسة واحدة بدون انتظار رمز" : "Sign in with one touch — no code to wait for"}
            </p>
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </>
        )}
      </div>

      {!done && (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleEnable}
            disabled={busy}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 active:scale-95"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "تفعيل" : "Enable")}
          </Button>
          <button
            type="button"
            onClick={handleLater}
            disabled={busy}
            aria-label={isAr ? "لاحقاً" : "Later"}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
