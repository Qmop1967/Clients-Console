'use client';

import { PRIVACY_SETTINGS_EVENT } from '@/components/analytics/consent-banner';

/** Footer entry point for changing the measurement decision (replaces the floating cookie button). */
export function PrivacySettingsLink({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" className={className}
      onClick={() => window.dispatchEvent(new Event(PRIVACY_SETTINGS_EVENT))}>
      {label}
    </button>
  );
}
