/**
 * TikTok commerce-event payload policy for TSH.
 *
 * The policy is intentionally PII-free and keeps catalog identifiers exact. TikTok's
 * web-event currency list does not currently include IQD, so monetary fields are
 * omitted for IQD instead of sending an invalid currency or inventing a conversion.
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
 * IQD. USD values may be sent as-is; IQD values are deliberately omitted until a
 * governed server-side FX source is introduced.
 */
function supportsTikTokMoney(currency: unknown): currency is string {
  return typeof currency === 'string' && currency.trim().toUpperCase() === 'USD';
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

  const allowMoney = supportsTikTokMoney(properties.currency);
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
      if (allowMoney && price !== undefined) content.price = price;
      return content;
    });

  if (contentIds.length) clean.content_ids = contentIds;
  if (contents?.length) clean.contents = contents;
  if (properties.content_type === 'product') clean.content_type = 'product';

  const contentName = cleanText(properties.content_name, 512);
  const contentCategory = cleanText(properties.content_category, 256);
  if (contentName) clean.content_name = contentName;
  if (contentCategory) clean.content_category = contentCategory;

  if (allowMoney) {
    clean.currency = 'USD';
    const value = finiteNonNegative(properties.value);
    if (value !== undefined) clean.value = value;
  }

  return clean;
}
