"use client";

// Lightweight celebration burst — no deps, auto-cleans, respects nothing fancy.
// Violet-forward palette = consignment identity.
export function fireConfetti(): void {
  if (typeof document === "undefined") return;
  if (!document.getElementById("csgn-cf-style")) {
    const st = document.createElement("style");
    st.id = "csgn-cf-style";
    st.textContent = "@keyframes csgnCfFall{to{transform:translateY(105vh) rotate(720deg);opacity:.1}}";
    document.head.appendChild(st);
  }
  const colors = ["#7c3aed", "#8b5cf6", "#059669", "#f59e0b", "#3b82f6", "#ec4899"];
  for (let i = 0; i < 40; i++) {
    const d = document.createElement("div");
    const s = 5 + Math.random() * 6;
    d.style.cssText =
      "position:fixed;top:-12px;left:" + (5 + Math.random() * 90) + "vw;width:" + s + "px;height:" + s +
      "px;border-radius:2px;z-index:9999;pointer-events:none;background:" + colors[i % colors.length] +
      ";animation:csgnCfFall " + (0.9 + Math.random() * 1.1) + "s linear " + (Math.random() * 0.25) + "s forwards";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(35); } catch { /* noop */ }
}
