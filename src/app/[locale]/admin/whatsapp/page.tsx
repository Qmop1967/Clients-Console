"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Admin WhatsApp session management page.
 * URL: https://tsh.sale/admin/whatsapp?key=YOUR_ADMIN_KEY
 *
 * Workflow:
 *   1. Enter admin key (or pass via ?key= URL param)
 *   2. Click "Refresh status" — see current session state
 *   3. If logged_out: click "Connect & Get QR" — page polls for QR
 *   4. Scan QR from your phone's WhatsApp Linked Devices
 *   5. Status flips to "connected" within seconds
 *
 * Without WASENDER_PAT/WASENDER_SESSION_ID/WASENDER_ADMIN_KEY env vars set,
 * all endpoints return 503 — page tells you what's missing.
 */

interface ProviderHealth {
  provider: string;
  state: string;
  consecutiveFailures: number;
  lastError: string | null;
  secondsSinceLastSuccess: number | null;
}

interface HealthResponse {
  status: string;
  ui: { whatsapp_available: boolean; whatsapp_provider_state: string; reason: string | null };
  probe: { enabled: boolean; lastProbeStatus: string | null; secondsSinceLastProbe: number | null };
  providers: ProviderHealth[];
}

export default function AdminWhatsAppPage() {
  const [adminKey, setAdminKey] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [polling, setPolling] = useState(false);

  // Read admin key from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const k = params.get("key");
    if (k) setAdminKey(k);
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/health");
      const data = await res.json();
      setHealth(data);
    } catch (e) {
      console.error("health fetch failed:", e);
    }
  }, []);

  // Auto-fetch health every 5s
  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 5000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  const callAdmin = async (path: string, method: "GET" | "POST" = "GET") => {
    if (!adminKey) {
      setError("Enter admin key first");
      return null;
    }
    const res = await fetch(path, {
      method,
      headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 503) {
        setError(`Admin not configured. Missing env vars: ${(data.missing || []).join(", ")}`);
      } else if (res.status === 401) {
        setError("Unauthorized — check admin key");
      } else {
        setError(`HTTP ${res.status}: ${data.error || JSON.stringify(data)}`);
      }
      return null;
    }
    setError("");
    return data;
  };

  const renderQr = (qrString: string) => {
    // Render QR as SVG using Google Charts (no extra libs needed)
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`;
    setQrSvg(url);
  };

  const handleConnect = async () => {
    setBusy(true);
    setError("");
    setInfo("Initializing session...");
    setQr(null);
    setQrSvg(null);

    const result = await callAdmin("/api/whatsapp/admin/connect", "POST");
    if (!result) {
      setBusy(false);
      return;
    }

    // Response shapes seen in docs:
    //   { success: true, data: { status: 'NEED_SCAN', qrCode: '2@...' } }
    //   { success: true, data: { status: 'ALREADY_CONNECTED' } }
    const status = result?.data?.status || result?.status;
    const qrCode = result?.data?.qrCode || result?.qrCode;

    if (status === "ALREADY_CONNECTED" || status === "CONNECTED") {
      setInfo("Session is already connected — nothing to do.");
      setBusy(false);
      fetchHealth();
      return;
    }

    if (qrCode) {
      setQr(qrCode);
      renderQr(qrCode);
      setInfo("Scan this QR with WhatsApp → Linked Devices");
      setPolling(true);
      pollForConnection();
    } else {
      setInfo("Connect started. Polling for QR...");
      setTimeout(handleGetQr, 2000);
    }

    setBusy(false);
  };

  const handleGetQr = async () => {
    const result = await callAdmin("/api/whatsapp/admin/qr");
    if (!result) return;
    const qrCode = result?.data?.qrCode || result?.qrCode;
    if (qrCode) {
      setQr(qrCode);
      renderQr(qrCode);
      setInfo("Scan this QR with WhatsApp → Linked Devices");
      setPolling(true);
      pollForConnection();
    } else {
      setError("No QR code returned. Try Connect first.");
    }
  };

  const pollForConnection = useCallback(() => {
    let attempts = 0;
    const maxAttempts = 60; // ~3 min at 3s interval
    const interval = setInterval(async () => {
      attempts++;
      await fetchHealth();
      // Check our internal probe state via /health
      const res = await fetch("/api/whatsapp/health").then((r) => r.json()).catch(() => null);
      const wasenderState = res?.providers?.find((p: ProviderHealth) => p.provider === "wasender")?.state;
      const probeStatus = res?.probe?.lastProbeStatus;

      if (probeStatus === "connected" || wasenderState === "CLOSED") {
        clearInterval(interval);
        setPolling(false);
        setQr(null);
        setQrSvg(null);
        setInfo("✅ Session connected successfully!");
      }
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setPolling(false);
        setError("Polling timeout. Try refreshing status manually.");
      }
    }, 3000);
  }, [fetchHealth]);

  const handleDisconnect = async () => {
    if (!confirm("Disconnect the WhatsApp session?")) return;
    setBusy(true);
    const result = await callAdmin("/api/whatsapp/admin/disconnect", "POST");
    setBusy(false);
    if (result) {
      setInfo("Disconnected. Session is now logged out.");
      setQr(null);
      setQrSvg(null);
    }
  };

  const wasender = health?.providers?.find((p) => p.provider === "wasender");
  const wasenderState = wasender?.state || "UNKNOWN";
  const probeStatus = health?.probe?.lastProbeStatus || "—";

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>WhatsApp Session Admin</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
          Self-service WASender session management. Authorized via x-admin-key header.
        </p>

        {/* Admin Key */}
        <div style={{ background: "#1e293b", padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13, color: "#94a3b8" }}>Admin Key</label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="WASENDER_ADMIN_KEY value"
            style={{
              width: "100%", padding: 10, background: "#0f172a", color: "#e2e8f0",
              border: "1px solid #334155", borderRadius: 6, fontFamily: "monospace", fontSize: 13,
            }}
          />
          <p style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
            Tip: pass via URL <code>?key=YOUR_KEY</code> for convenience
          </p>
        </div>

        {/* Live Status */}
        <div style={{ background: "#1e293b", padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Current Status</h2>
          {health ? (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, fontSize: 13 }}>
              <div style={{ color: "#94a3b8" }}>Overall:</div>
              <div style={{ fontWeight: 600, color: health.status === "OK" ? "#22c55e" : health.status === "DEGRADED" ? "#f59e0b" : "#ef4444" }}>
                {health.status}
              </div>
              <div style={{ color: "#94a3b8" }}>WASender circuit:</div>
              <div style={{ fontWeight: 600, color: wasenderState === "CLOSED" ? "#22c55e" : "#ef4444" }}>
                {wasenderState} {wasender?.consecutiveFailures ? `(${wasender.consecutiveFailures} failures)` : ""}
              </div>
              <div style={{ color: "#94a3b8" }}>Last probe:</div>
              <div>
                {probeStatus} {health.probe?.secondsSinceLastProbe !== null ? `(${health.probe.secondsSinceLastProbe}s ago)` : ""}
              </div>
              {wasender?.lastError && (
                <>
                  <div style={{ color: "#94a3b8" }}>Last error:</div>
                  <div style={{ color: "#fca5a5", fontSize: 12 }}>{wasender.lastError}</div>
                </>
              )}
            </div>
          ) : (
            <div style={{ color: "#64748b" }}>Loading...</div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={handleConnect}
            disabled={busy || polling}
            style={{ padding: "10px 16px", background: "#16a34a", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontWeight: 600, opacity: busy || polling ? 0.5 : 1 }}
          >
            🔗 Connect & Get QR
          </button>
          <button
            onClick={handleGetQr}
            disabled={busy || polling}
            style={{ padding: "10px 16px", background: "#2563eb", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontWeight: 600, opacity: busy || polling ? 0.5 : 1 }}
          >
            📷 Refresh QR
          </button>
          <button
            onClick={handleDisconnect}
            disabled={busy}
            style={{ padding: "10px 16px", background: "#dc2626", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontWeight: 600, opacity: busy ? 0.5 : 1 }}
          >
            🔌 Disconnect
          </button>
          <button
            onClick={fetchHealth}
            style={{ padding: "10px 16px", background: "#475569", color: "white", border: 0, borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
          >
            🔄 Refresh status
          </button>
        </div>

        {/* Status messages */}
        {error && (
          <div style={{ background: "#7f1d1d", color: "#fecaca", padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            ❌ {error}
          </div>
        )}
        {info && !error && (
          <div style={{ background: "#1e3a8a", color: "#bfdbfe", padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
            ℹ️ {info}
          </div>
        )}

        {/* QR display */}
        {qrSvg && (
          <div style={{ background: "white", padding: 24, borderRadius: 12, textAlign: "center", marginTop: 16 }}>
            <img src={qrSvg} alt="WhatsApp QR" style={{ width: 300, height: 300 }} />
            <p style={{ color: "#475569", fontSize: 14, marginTop: 12 }}>
              📱 Open WhatsApp on your phone → ⋮ → Linked Devices → Link a Device
            </p>
            {polling && (
              <p style={{ color: "#16a34a", fontSize: 13, marginTop: 8 }}>
                ⏳ Waiting for scan... (auto-detects within 60s)
              </p>
            )}
          </div>
        )}

        {/* Raw QR string (for debug) */}
        {qr && (
          <details style={{ marginTop: 16, color: "#64748b", fontSize: 11 }}>
            <summary style={{ cursor: "pointer" }}>Raw QR string (debug)</summary>
            <code style={{ display: "block", background: "#0f172a", padding: 8, borderRadius: 4, marginTop: 4, wordBreak: "break-all" }}>
              {qr}
            </code>
          </details>
        )}
      </div>
    </div>
  );
}
