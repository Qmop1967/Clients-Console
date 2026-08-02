/**
 * TikTok commerce-event payload policy for TSH.
 *
 * The policy is intentionally PII-free and keeps catalog identifiers exact. TikTok's
 * web-event currency list does not currently include IQD. IQD money is converted to
 * USD only when a governed IQD-per-USD rate is explicitly configured; otherwise it is
 * omitted instead of sending an invalid currency or inventing a conversion.
 */

export interface TikTokContentItem {
  content_id: string;
  content_name?: string;
  content_category?: string;
  quantity: number;
  price?: number;
}

export interface TikTokEventProperties {
  content_ids?: string[];
  contents?: TikTokContentItem[];
  content_type?: 'product';
  content_name?: string;
  content_category?: string;
  currency?: string;
  value?: number;
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

/**
 * TSH currently advertises from a USD TikTok ad account while the storefront is in
 * IQD. The public rate is a non-secret build-time setting and must mirror the current
 * governed Odoo rate. Invalid/missing rates fail closed by omitting monetary fields.
 */
function configuredIqdPerUsd(): number | undefined {
  const value = Number(process.env.NEXT_PUBLIC_TIKTOK_IQD_PER_USD || '');
  return Number.isFinite(value) && value >= 100 && value <= 100_000 ? value : undefined;
}

function moneyConverter(currency: unknown): ((value: number) => number) | undefined {
  if (typeof currency !== 'string') return undefined;
  const normalized = currency.trim().toUpperCase();
  if (normalized === 'USD') return (value) => value;
  if (normalized !== 'IQD') return undefined;
  const iqdPerUsd = configuredIqdPerUsd();
  if (!iqdPerUsd) return undefined;
  return (value) => Math.round((value / iqdPerUsd) * 100) / 100;
}

export function sanitizeTikTokProperties(
  properties: TikTokEventProperties,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  const contentIds: string[] = [];
  const seenIds = new Set<string>();

  const addContentId = (value: unknown): string | undefined => {
    const id = cleanText(value, 100);
    if (!id) return undefined;
    if (!seenIds.has(id) && contentIds.length < 100) {
      seenIds.add(id);
      contentIds.push(id);
    }
    return id;
  };

  properties.content_ids?.forEach(addContentId);

  const convertMoney = moneyConverter(properties.currency);
  const contents = properties.contents
    ?.filter(
      (item) =>
        Boolean(cleanText(item?.content_id, 100)) &&
        typeof item?.quantity === 'number' &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0,
    )
    .slice(0, 100)
    .map((item) => {
      const contentId = addContentId(item.content_id) as string;
      const content: Record<string, unknown> = {
        content_id: contentId,
        quantity: Math.max(1, Math.trunc(item.quantity)),
      };
      const name = cleanText(item.content_name, 512);
      const category = cleanText(item.content_category, 256);
      const price = finiteNonNegative(item.price);
      if (name) content.content_name = name;
      if (category) content.content_category = category;
      if (convertMoney && price !== undefined) content.price = convertMoney(price);
      return content;
    });

  if (contentIds.length) clean.content_ids = contentIds;
  if (contents?.length) clean.contents = contents;
  if (properties.content_type === 'product') clean.content_type = 'product';

  const contentName = cleanText(properties.content_name, 512);
  const contentCategory = cleanText(properties.content_category, 256);
  if (contentName) clean.content_name = contentName;
  if (contentCategory) clean.content_category = contentCategory;

  if (convertMoney) {
    clean.currency = 'USD';
    const value = finiteNonNegative(properties.value);
    if (value !== undefined) clean.value = convertMoney(value);
  }

  return clean;
}
