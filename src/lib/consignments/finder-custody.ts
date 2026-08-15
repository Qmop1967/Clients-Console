export interface FinderCustodySource {
  consignment_id: number;
  consignment_name: string;
  line_id: number;
  qty_remaining: number;
  reportable_qty: number;
  invoice_unit_price: number;
  suggested_retail_price: number;
  currency_id: number;
}

export interface FinderCustodyAggregate extends FinderCustodySource {
  source_count: number;
  mixed_currency: boolean;
  sources: FinderCustodySource[];
}

export function aggregateFinderCustody(
  sources: FinderCustodySource[],
): FinderCustodyAggregate | null {
  const unique = sources.filter((source, index, all) =>
    Number.isInteger(Number(source.line_id)) && Number(source.line_id) > 0 &&
    all.findIndex((candidate) => Number(candidate.line_id) === Number(source.line_id)) === index,
  );
  const selected = selectReportableCustodySource(unique) || unique[0] || null;
  if (!selected) return null;
  return {
    ...selected,
    qty_remaining: unique.reduce((sum, source) => sum + Number(source.qty_remaining || 0), 0),
    reportable_qty: unique.reduce((sum, source) => sum + Number(source.reportable_qty || 0), 0),
    source_count: unique.length,
    mixed_currency: new Set(unique.map((source) => Number(source.currency_id))).size > 1,
    sources: unique,
  };
}

export function normalizeFinderCustody(
  custody: (Partial<FinderCustodyAggregate> & FinderCustodySource) | null,
): FinderCustodyAggregate | null {
  if (!custody) return null;
  const sources = Array.isArray(custody.sources) && custody.sources.length
    ? custody.sources
    : [{
      consignment_id: custody.consignment_id,
      consignment_name: custody.consignment_name,
      line_id: custody.line_id,
      qty_remaining: custody.qty_remaining,
      reportable_qty: custody.reportable_qty,
      invoice_unit_price: custody.invoice_unit_price,
      suggested_retail_price: custody.suggested_retail_price,
      currency_id: custody.currency_id,
    }];
  return aggregateFinderCustody(sources);
}

export function selectReportableCustodySource(
  sources: FinderCustodySource[],
): FinderCustodySource | null {
  return [...sources]
    .filter((source) => Number(source.reportable_qty) > 0)
    .sort((left, right) =>
      Number(right.reportable_qty) - Number(left.reportable_qty) ||
      Number(left.line_id) - Number(right.line_id),
    )[0] || null;
}

export function isLatestFinderRequest(requestId: number, currentId: number): boolean {
  return Number.isInteger(requestId) && requestId === currentId;
}
