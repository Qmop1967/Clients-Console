import { NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  type GenerateRegistrationOptionsOpts,
} from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { auth } from '@/lib/auth/auth';
import { issueWebAuthnChallenge } from '@/lib/auth-tickets';
import { getPartnerPasskeys } from '@/lib/odoo/passkeys';

const rpName = 'TSH Clients Console';
const rpID = process.env.NEXTAUTH_URL?.includes('localhost') ? 'localhost' : 'tsh.sale';

export async function POST() {
  try {
    // Enrollment is only for an authenticated customer — bind the passkey to
    // the session's partner, never to a client-supplied email.
    const session = await auth();
    const email = String(session?.user?.email || '').trim().toLowerCase();
    const partnerId = Number(session?.user?.odooPartnerId || session?.user?.id || 0);

    if (!session?.user || !Number.isInteger(partnerId) || partnerId <= 0) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    // Synthetic placeholder emails can't own a real passkey login.
    if (!email.includes('@') || email.endsWith('@tsh.local')) {
      return NextResponse.json({ error: 'email_required' }, { status: 400 });
    }

    const existing = await getPartnerPasskeys(partnerId);

    const opts: GenerateRegistrationOptionsOpts = {
      rpName,
      rpID,
      userID: new TextEncoder().encode(String(partnerId)),
      userName: email,
      userDisplayName: email.split('@')[0],
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({
        id: p.id,
        transports: p.transports as AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    };

    const options = await generateRegistrationOptions(opts);
    const challengeToken = issueWebAuthnChallenge('wa-reg', { partnerId, email }, options.challenge);

    console.log('[WebAuthn Register] Options generated for partner:', partnerId);
    return NextResponse.json({ options, challengeToken });
  } catch (error) {
    console.error('[WebAuthn Register Options] Error:', error);
    return NextResponse.json({ error: 'store_unavailable' }, { status: 503 });
  }
}
