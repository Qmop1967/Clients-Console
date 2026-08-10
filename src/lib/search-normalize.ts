/** Arabic-tolerant normalization shared by catalog and purchase search. */
export function normalizeProductSearch(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ڤﭬ]/g, 'ف')
    .replace(/[گݣ]/g, 'ك')
    .replace(/چ/g, 'ج')
    .replace(/ق/g, 'ك')
    .replace(/\s+/g, ' ')
    .trim();
}
