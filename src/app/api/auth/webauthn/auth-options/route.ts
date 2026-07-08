import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  type GenerateAuthenticationOptionsOpts,
} from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { issueWebAuthnChallenge } from '@/lib/auth-tickets';
import { getPartnerPasskeys } from '@/lib/odoo/passkeys';

const rpID = process.env.NEXTAUTH_URL?.includes('localhost') ? 'localhost' : 'tsh.sale';

// Resolve email → partner via the gateway, mirroring otp/send-email. Returns
// null on unknown email OR any lookup error — the caller returns an identical
// generic 404 in every case so we never reveal whether an email is registered.
async function findPartnerIdByEmail(email: string): Promise<number | null> {
  const gatewayUrl = process.env.API_GATEWAY_URL || 'http://127.0.0.1:3010';
  const apiKey = process.env.API_KEY || '';
  try {
    const res = await fetch(`${gatewayUrl}/api/odoo/search_read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        model: 'res.partner',
        domain: [
          '&', '&',
          ['customer_rank', '>', 0],
          ['active', '=', true],
          ['email', '=ilike', email.toLowerCase()],
        ],
        fields: ['id', 'email'],
        limit: 2,
        order: 'id ASC',
      }),
    });
    const data = await res.json();
    const records = data?.data || data?.result || data || [];
    // Exactly one match only; ambiguous (>1) is treated as "no passkeys".
    if (Array.isArray(records) && records.length === 1) {
      return Number(records[0].id) || null;
    }
    return null;
  } catch (err) {
    console.error('[WebAuthn Auth] email lookup error:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    const partnerId = await findPartnerIdByEmail(cleanEmail);
    // Generic 404 whether the email is unknown OR simply has no passkeys.
    if (!partnerId) {
      return NextResponse.json({ error: 'no_passkeys' }, { status: 404 });
    }

    const records = await getPartnerPasskeys(partnerId);
    if (records.length === 0) {
      return NextResponse.json({ error: 'no_passkeys' }, { status: 404 });
    }

    const opts: GenerateAuthenticationOptionsOpts = {
      rpID,
      allowCredentials: records.map((p) => ({
        id: p.id,
        transports: p.transports as AuthenticatorTransportFuture[] | undefined,
      })),
      userVerification: 'preferred',
    };

    const options = await generateAuthenticationOptions(opts);
    const challengeToken = issueWebAuthnChallenge('wa-auth', { partnerId, email: cleanEmail }, options.challenge);

    console.log('[WebAuthn Auth] Options generated for partner:', partnerId);
    return NextResponse.json({ options, challengeToken });
  } catch (error) {
    console.error('[WebAuthn Auth Options] Error:', error);
    return NextResponse.json({ error: 'store_unavailable' }, { status: 503 });
  }
}
