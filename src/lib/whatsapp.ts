// ============================================
// WhatsApp OTP Provider — with Auto-Fallback
// ============================================
// Primary provider: WHATSAPP_PROVIDER env var
// Fallback: automatically tries other configured providers
// ============================================

const PROVIDER = process.env.WHATSAPP_PROVIDER || 'dev';

interface SendResult {
  success: boolean;
  error?: string;
  provider?: string;
}

// Arabic OTP message template
function otpMessage(code: string): string {
  return `${code} هو رمز التحقق الخاص بك 🔐

TSH | tsh.sale
صالح لمدة 10 دقائق`;
}

// ============================================
// WASenderApi Provider ($6/mo, unlimited)
// ============================================
async function sendWasender(phone: string, message: string): Promise<SendResult> {
  const apiKey = process.env.WASENDER_API_KEY;
  if (!apiKey) return { success: false, error: 'Provider not configured', provider: 'wasender' };

  const e164 = phone.startsWith('+') ? phone.substring(1) : phone;

  try {
    const res = await fetch('https://www.wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: e164, text: message }),
    });

    const data = await res.json();

    if (res.ok && (data.success || data.status === 'sent' || data.id || data.messageId)) {
      console.log('[WhatsApp] WASenderApi sent to:', e164);
      return { success: true, provider: 'wasender' };
    }

    console.error('[WhatsApp] WASenderApi error:', res.status, data);
    return { success: false, error: data.message || data.error || 'Send failed', provider: 'wasender' };
  } catch (err) {
    console.error('[WhatsApp] WASenderApi exception:', err);
    return { success: false, error: 'Network error', provider: 'wasender' };
  }
}

// ============================================
// Ultramsg Provider
// ============================================
async function sendUltramsg(phone: string, message: string): Promise<SendResult> {
  const instanceId = process.env.ULTRAMSG_INSTANCE_ID;
  const token = process.env.ULTRAMSG_TOKEN;
  if (!instanceId || !token) return { success: false, error: 'Provider not configured', provider: 'ultramsg' };

  try {
    const res = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, to: phone, body: message }),
    });

    const data = await res.json();

    if (data.sent === 'true' || data.sent === true || data.id) {
      console.log('[WhatsApp] Ultramsg sent to:', phone);
      return { success: true, provider: 'ultramsg' };
    }

    console.error('[WhatsApp] Ultramsg error:', data);
    return { success: false, error: data.error || 'Send failed', provider: 'ultramsg' };
  } catch (err) {
    console.error('[WhatsApp] Ultramsg exception:', err);
    return { success: false, error: 'Network error', provider: 'ultramsg' };
  }
}

// ============================================
// Meta Cloud API Provider
// ============================================
async function sendMeta(phone: string, message: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_META_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_ID;
  if (!token || !phoneNumberId) return { success: false, error: 'Provider not configured', provider: 'meta' };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    const data = await res.json();

    if (data.messages && data.messages[0]?.id) {
      console.log('[WhatsApp] Meta API sent to:', phone);
      return { success: true, provider: 'meta' };
    }

    console.error('[WhatsApp] Meta API error:', data);
    return { success: false, error: data.error?.message || 'Send failed', provider: 'meta' };
  } catch (err) {
    console.error('[WhatsApp] Meta API exception:', err);
    return { success: false, error: 'Network error', provider: 'meta' };
  }
}

// ============================================
// Twilio Provider
// ============================================
async function sendTwilio(phone: string, message: string): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid || !authToken || !fromNumber) return { success: false, error: 'Provider not configured', provider: 'twilio' };

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: `whatsapp:+${phone}`,
          Body: message,
        }).toString(),
      }
    );

    const data = await res.json();

    if (data.sid) {
      console.log('[WhatsApp] Twilio sent to:', phone);
      return { success: true, provider: 'twilio' };
    }

    console.error('[WhatsApp] Twilio error:', data);
    return { success: false, error: data.message || 'Send failed', provider: 'twilio' };
  } catch (err) {
    console.error('[WhatsApp] Twilio exception:', err);
    return { success: false, error: 'Network error', provider: 'twilio' };
  }
}

// ============================================
// OpenClaw WhatsApp Provider (Baileys via local API)
// ============================================
async function sendOpenClaw(phone: string, message: string): Promise<SendResult> {
  const gatewayUrl = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
  const apiKey = process.env.API_KEY || '';

  // Format phone for WhatsApp: +9647XXXXXXXX
  let target = phone;
  if (!target.startsWith('+')) target = '+' + target;

  try {
    const res = await fetch(`${gatewayUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        to: target,
        message: message,
      }),
    });

    const data = await res.json();
    if (res.ok && (data.success || data.messageId)) {
      console.log('[WhatsApp] OpenClaw/Gateway sent to:', target);
      return { success: true, provider: 'openclaw' };
    }

    console.error('[WhatsApp] OpenClaw/Gateway error:', res.status, data);
    return { success: false, error: data.error || 'Send failed', provider: 'openclaw' };
  } catch (err) {
    console.error('[WhatsApp] OpenClaw/Gateway exception:', err);
    return { success: false, error: 'Network error', provider: 'openclaw' };
  }
}

// ============================================
// Dev Mode (console log)
// ============================================
async function sendDev(phone: string, message: string): Promise<SendResult> {
  console.log('========================================');
  console.log(`[WhatsApp DEV] OTP to ${phone}:`);
  console.log(message);
  console.log('========================================');
  return { success: true, provider: 'dev' };
}

// ============================================
// Provider registry
// ============================================
type ProviderFn = (phone: string, message: string) => Promise<SendResult>;

const PROVIDERS: Record<string, ProviderFn> = {
  openclaw: sendOpenClaw,
  wasender: sendWasender,
  ultramsg: sendUltramsg,
  meta: sendMeta,
  twilio: sendTwilio,
  dev: sendDev,
};

// Fallback order (excluding dev)
const FALLBACK_ORDER = ['openclaw', 'wasender', 'ultramsg', 'meta', 'twilio'];

// Small delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// Alert when primary provider fails
// ============================================
let lastAlertTime = 0;
async function alertProviderDown(provider: string, error: string) {
  const now = Date.now();
  // Only alert once every 10 minutes to avoid spam
  if (now - lastAlertTime < 10 * 60 * 1000) return;
  lastAlertTime = now;

  const gatewayUrl = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
  const apiKey = process.env.API_KEY || '';

  try {
    // Log to gateway for monitoring
    console.error(`[WhatsApp ALERT] Primary provider "${provider}" is DOWN: ${error}`);
    
    // Try to send Telegram alert via gateway
    await fetch(`${gatewayUrl}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        type: 'whatsapp_provider_down',
        message: `⚠️ WhatsApp OTP: ${provider} is down — ${error}. Fallback active.`,
      }),
    }).catch(() => {}); // Best effort
  } catch {
    // Ignore alert errors
  }
}

// ============================================
// Main Send Function — with Retry + Fallback
// ============================================
export async function sendWhatsAppOTP(phone: string, code: string): Promise<SendResult> {
  const message = otpMessage(code);

  // Dev mode — skip all fallback logic
  if (PROVIDER === 'dev') {
    return sendDev(phone, message);
  }

  const primaryFn = PROVIDERS[PROVIDER];
  if (!primaryFn) {
    console.error(`[WhatsApp] Unknown provider: ${PROVIDER}`);
    return { success: false, error: `Unknown provider: ${PROVIDER}` };
  }

  // --- Try primary provider ---
  let result = await primaryFn(phone, message);
  if (result.success) return result;

  // --- Retry primary once after 2s ---
  console.warn(`[WhatsApp] Primary (${PROVIDER}) failed, retrying in 2s...`);
  await delay(2000);
  result = await primaryFn(phone, message);
  if (result.success) return result;

  // --- Primary failed twice — alert + try fallbacks ---
  console.error(`[WhatsApp] Primary (${PROVIDER}) failed twice: ${result.error}`);
  alertProviderDown(PROVIDER, result.error || 'Unknown error');

  // Try each fallback provider (skip the primary we already tried)
  for (const name of FALLBACK_ORDER) {
    if (name === PROVIDER) continue;
    
    const fn = PROVIDERS[name];
    if (!fn) continue;

    console.log(`[WhatsApp] Trying fallback: ${name}`);
    const fallbackResult = await fn(phone, message);
    
    if (fallbackResult.success) {
      console.log(`[WhatsApp] ✅ Fallback ${name} succeeded`);
      return fallbackResult;
    }

    // If "not configured", skip silently
    if (fallbackResult.error === 'Provider not configured') continue;

    console.warn(`[WhatsApp] Fallback ${name} also failed: ${fallbackResult.error}`);
  }

  // All providers failed
  console.error('[WhatsApp] ❌ ALL providers failed for:', phone);
  return { success: false, error: 'All WhatsApp providers failed' };
}

export function isDevMode(): boolean {
  return PROVIDER === 'dev';
}
