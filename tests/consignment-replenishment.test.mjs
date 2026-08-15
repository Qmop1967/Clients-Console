import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  catalogueStatuses,
  normalizeCatalogue,
  normalizeReplenishmentHistory,
} from "../src/lib/consignments/catalogue.ts";
import {
  addReplenishmentLine,
  beginReplenishmentSubmission,
  createReplenishmentCart,
  parseReplenishmentCart,
  readReplenishmentAcknowledgements,
  reconcileReplenishmentCart,
  replenishmentHistoryMatchesCart,
  replenishmentStorageKey,
  replenishmentSubmissionHash,
  isDefiniteReplenishmentFailure,
  setReplenishmentQuantity,
  unlockAfterConfirmedFailure,
} from "../src/lib/consignments/replenishment-cart.ts";
import { actorTokenNeedsRefresh } from "../src/lib/consignments/actor-claims.ts";
import {
  normalizeFinderCustody,
  isLatestFinderRequest,
  selectReportableCustodySource,
} from "../src/lib/consignments/finder-custody.ts";
import {
  getOrCreateMutationKey,
  createSaleOneAttempt,
  isConfirmedMutationFailure,
  mutationOperationStorageKey,
  reconcileOptimisticSaleCounts,
} from "../src/lib/consignments/operation-key.ts";
import { consignmentReturnableQty } from "../src/lib/consignments/return-availability.ts";

test("catalogue keeps central stock separate from replenishment eligibility", () => {
  const [blocked, available] = normalizeCatalogue({
    data: [
      {
        product_id: 11,
        name: "Reserved battery",
        code: "BAT-11",
        eligible: true,
        central_free: 5,
        available_for_replenishment: 5,
        custody: 2,
        pending_topup: 1,
        in_transit_topup: 3,
        status: {
          can_replenish: false,
          profile_enabled: true,
        },
      },
      {
        product_id: 12,
        name: "Available battery",
        eligible: true,
        central_free: 7,
        available_for_replenishment: 4,
        custody: 0,
        pending_topup: 0,
        in_transit_topup: 0,
        status: {
          can_replenish: true,
          profile_enabled: true,
        },
      },
    ],
  });

  assert.equal(blocked.central_available, true);
  assert.equal(blocked.can_replenish, false);
  assert.deepEqual(catalogueStatuses(blocked), ["central", "custody", "pending"]);
  assert.equal(available.can_replenish, true);
  assert.equal(available.available_qty, 4);
});

test("catalogue reports unavailable and likely as independent statuses", () => {
  const [product] = normalizeCatalogue({
    data: [{
      product_id: 20,
      name: "Likely battery",
      eligible: true,
      central_free: 0,
      available_for_replenishment: 0,
      custody: 0,
      pending_topup: 0,
      in_transit_topup: 0,
      confidence: "likely",
      status: { can_replenish: false, profile_enabled: true },
    }],
  });
  assert.deepEqual(catalogueStatuses(product), ["unavailable", "likely"]);
});

test("cart is partner namespaced and locks submitted payload", async () => {
  assert.notEqual(replenishmentStorageKey("10"), replenishmentStorageKey("11"));
  const initial = createReplenishmentCart("11111111-1111-4111-8111-111111111111");
  const withLine = addReplenishmentLine(initial, {
    product_id: 42,
    name: "Battery 42",
    code: "B42",
    confidence: "likely",
  });
  const hash = await replenishmentSubmissionHash(withLine);
  const locked = beginReplenishmentSubmission(withLine, hash);

  assert.equal(locked.submissionPending, true);
  assert.equal(locked.submissionHash, hash);
  assert.equal(setReplenishmentQuantity(locked, 42, 7), locked);
  assert.equal(addReplenishmentLine(locked, { product_id: 43, name: "Other" }), locked);
  assert.deepEqual(parseReplenishmentCart(JSON.stringify(locked)), locked);

  const unlocked = unlockAfterConfirmedFailure(
    locked,
    "22222222-2222-4222-8222-222222222222",
  );
  assert.equal(unlocked.submissionPending, false);
  assert.notEqual(unlocked.idempotencyKey, locked.idempotencyKey);
  assert.equal(setReplenishmentQuantity(unlocked, 42, 7).lines[0].qty, 7);
});

test("cart caps live availability, removes stale products and unlocks business 409", () => {
  const initial = addReplenishmentLine(
    createReplenishmentCart("11111111-1111-4111-8111-111111111111"),
    { product_id: 42, name: "Battery 42", qty: 8 },
  );
  const withStale = addReplenishmentLine(initial, { product_id: 99, name: "Stale", qty: 2 });
  const reconciled = reconcileReplenishmentCart(withStale, [
    { product_id: 42, can_replenish: true, available_qty: 3 },
    { product_id: 99, can_replenish: false, available_qty: 10 },
  ]);
  assert.deepEqual(reconciled.lines.map(({ product_id, qty }) => ({ product_id, qty })), [
    { product_id: 42, qty: 3 },
  ]);
  assert.equal(isDefiniteReplenishmentFailure(409, { code: "INSUFFICIENT_STOCK" }), true);
  assert.equal(isDefiniteReplenishmentFailure(409, { code: "NO_ACTIVE_ANCHOR" }), true);
  assert.equal(isDefiniteReplenishmentFailure(409, { code: "PROFILE_DISABLED" }), true);
  assert.equal(isDefiniteReplenishmentFailure(409, { code: "CONSIGNMENT_LIMIT_EXCEEDED" }), true);
  assert.equal(isDefiniteReplenishmentFailure(409, { code: "IDEMPOTENCY_PAYLOAD_MISMATCH" }), true);
  assert.equal(isDefiniteReplenishmentFailure(409, { code: "ANCHOR_CURRENCY_MISMATCH" }), true);
  assert.equal(isDefiniteReplenishmentFailure(409, { code: "MISSING_PRICE" }), true);
  assert.equal(isDefiniteReplenishmentFailure(409, { code: "IDEMPOTENCY_IN_PROGRESS" }), false);
});

test("history acknowledgement must match key and exact aggregate lines", () => {
  const cart = addReplenishmentLine(
    addReplenishmentLine(
      createReplenishmentCart("11111111-1111-4111-8111-111111111111"),
      { product_id: 42, name: "Battery 42", qty: 3 },
    ),
    { product_id: 43, name: "Battery 43", qty: 2 },
  );
  const history = [
    { group_key: cart.idempotencyKey, lines: [{ product_id: 42, qty: 1 }] },
    { group_key: cart.idempotencyKey, lines: [{ product_id: 42, qty: 2 }, { product_id: 43, qty: 2 }] },
  ];
  assert.equal(replenishmentHistoryMatchesCart(history, cart), true);
  assert.equal(replenishmentHistoryMatchesCart([
    { group_key: cart.idempotencyKey, lines: [{ product_id: 42, qty: 3 }] },
  ], cart), false);
});

test("acknowledgement requires traceable id, reference and state for every split", () => {
  assert.deepEqual(readReplenishmentAcknowledgements({
    data: [
      { id: 5, x_name: "TOP/0005", x_state: "requested" },
      { id: 6, x_name: "TOP/0006", x_state: "requested" },
    ],
  }), [
    { id: "5", name: "TOP/0005", state: "requested" },
    { id: "6", name: "TOP/0006", state: "requested" },
  ]);

  assert.equal(readReplenishmentAcknowledgements({
    data: [{ id: 5, x_state: "requested" }],
  }), null);
  assert.equal(readReplenishmentAcknowledgements({ data: [] }), null);
});

test("history normalizes request grouping for timeout resolution", () => {
  const items = normalizeReplenishmentHistory({
    data: [{
      id: 9,
      x_name: "TOP/0009",
      x_state: "in_transit",
      x_request_group_key: "idem-1234567890123456",
      x_date_requested: "2026-08-15T09:00:00Z",
      x_notes: "Next visit",
      lines: [{ product_id: 42, qty: 3, product_name: "Battery 42" }],
    }],
  });
  assert.equal(items[0].group_key, "idem-1234567890123456");
  assert.equal(items[0].lines[0].qty, 3);
});

test("strict consignment gateway never emits raw partner identity headers", () => {
  const strictGateway = readFileSync(new URL("../src/lib/consignments/server-gateway.ts", import.meta.url), "utf8");
  const proxyGateway = readFileSync(new URL("../src/app/api/consignments/helpers.ts", import.meta.url), "utf8");
  assert.equal(strictGateway.includes("x-partner-id"), false);
  assert.equal(proxyGateway.includes("x-partner-id"), false);
  assert.equal(strictGateway.includes("x-actor-token"), true);
  assert.equal(proxyGateway.includes("x-actor-token"), true);
  const serviceWorker = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.equal(serviceWorker.includes("n  // Consignment screens"), false);
  assert.match(serviceWorker, /consignments/);
});

test("client actor claims bind cached token to partner, role and human actor", () => {
  const now = 2_000_000_000;
  const token = (claims) => [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "signature",
  ].join(".");
  const valid = token({ exp: now + 3600, partner_id: 42, role: "client", type: "human" });
  assert.equal(actorTokenNeedsRefresh(valid, "42", now), false);
  assert.equal(actorTokenNeedsRefresh(valid, "43", now), true);
  assert.equal(actorTokenNeedsRefresh(token({ exp: now + 3600, partner_id: 42, role: "admin", type: "human" }), 42, now), true);
  assert.equal(actorTokenNeedsRefresh(token({ exp: now + 3600, partner_id: 42, role: "client", type: "service" }), 42, now), true);
});

test("mutation keys survive retry/reload without Math.random", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const key = mutationOperationStorageKey("sale-one", { consignmentId: 7, lineId: 9, qty: 1 });
  const first = getOrCreateMutationKey(storage, key, () => "11111111-1111-4111-8111-111111111111");
  const retry = getOrCreateMutationKey(storage, key, () => "22222222-2222-4222-8222-222222222222");
  assert.equal(first, retry);
  assert.equal(isConfirmedMutationFailure(409, { code: "NOT_ACTIVE" }), true);
  assert.equal(isConfirmedMutationFailure(409, { code: "IDEMPOTENCY_IN_PROGRESS" }), false);
});

test("one-tap sale freezes the allocation and retry key across prop/source changes", () => {
  const attempt = createSaleOneAttempt({ consignmentId: 7, lineId: 10, productId: 42 });
  const nextRenderSource = { consignmentId: 8, lineId: 20, productId: 42 };
  assert.equal(attempt.consignmentId, 7);
  assert.equal(attempt.lineId, 10);
  assert.notEqual(attempt.operationStorageKey, createSaleOneAttempt(nextRenderSource).operationStorageKey);

  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const first = getOrCreateMutationKey(storage, attempt.operationStorageKey, () => "11111111-1111-4111-8111-111111111111");
  const lostResponseRetry = getOrCreateMutationKey(storage, attempt.operationStorageKey, () => "22222222-2222-4222-8222-222222222222");
  assert.equal(lostResponseRetry, first);
});

test("last-unit one-tap action remains mounted and disables only its idle UI", () => {
  const detail = readFileSync(new URL("../src/components/consignments/consignment-detail.tsx", import.meta.url), "utf8");
  const finder = readFileSync(new URL("../src/components/consignments/battery-finder.tsx", import.meta.url), "utf8");
  const button = readFileSync(new URL("../src/components/consignments/sell-one-button.tsx", import.meta.url), "utf8");
  assert.equal(/reportable_qty\) - opt > 0 && \(\s*<SellOneButton/.test(detail), false);
  assert.match(detail, /disabled=\{Number\(line\.reportable_qty\) - opt <= 0\}/);
  assert.match(finder, /\{p\.custody && \(\s*<SellOneButton/);
  assert.match(button, /phase === "idle" && disabled && hideWhenDisabled/);
  assert.match(button, /attemptRef\.current/);
  assert.equal(detail.includes("delete next[attempt.lineId]"), false);
});

test("server refresh acknowledges only committed optimistic units", () => {
  const optimistic = { 10: 2, 20: 1 };
  assert.deepEqual(reconcileOptimisticSaleCounts(
    optimistic,
    { 10: 5, 20: 3 },
    { 10: 4, 20: 3 },
  ), { 10: 1, 20: 1 });
  assert.deepEqual(reconcileOptimisticSaleCounts(
    { 10: 1 },
    { 10: 1 },
    { 10: 0 },
  ), {});
});

test("finder always chooses an actually reportable custody allocation", () => {
  const custody = normalizeFinderCustody({
    consignment_id: 1,
    consignment_name: "C1",
    line_id: 10,
    qty_remaining: 6,
    reportable_qty: 2,
    invoice_unit_price: 1,
    suggested_retail_price: 2,
    currency_id: 1,
    source_count: 2,
    mixed_currency: true,
    sources: [
      { consignment_id: 1, consignment_name: "C1", line_id: 10, qty_remaining: 4, reportable_qty: 0, invoice_unit_price: 1, suggested_retail_price: 2, currency_id: 1 },
      { consignment_id: 2, consignment_name: "C2", line_id: 20, qty_remaining: 2, reportable_qty: 2, invoice_unit_price: 1500, suggested_retail_price: 2000, currency_id: 87 },
    ],
  });
  const selected = selectReportableCustodySource(custody?.sources || []);
  assert.equal(selected?.line_id, 20);
  assert.equal(custody?.mixed_currency, true);
  assert.equal(custody?.reportable_qty, 2);
  assert.equal(isLatestFinderRequest(4, 5), false);
  assert.equal(isLatestFinderRequest(5, 5), true);
  const ordered = normalizeFinderCustody({
    consignment_id: 3,
    consignment_name: "C3",
    line_id: 30,
    qty_remaining: 6,
    reportable_qty: 6,
    invoice_unit_price: 1,
    suggested_retail_price: 2,
    currency_id: 1,
    sources: [
      { consignment_id: 3, consignment_name: "C3", line_id: 30, qty_remaining: 1, reportable_qty: 1, invoice_unit_price: 1, suggested_retail_price: 2, currency_id: 1 },
      { consignment_id: 4, consignment_name: "C4", line_id: 40, qty_remaining: 5, reportable_qty: 5, invoice_unit_price: 1500, suggested_retail_price: 2000, currency_id: 87 },
    ],
  });
  assert.equal(selectReportableCustodySource(ordered?.sources || [])?.line_id, 30);
});

test("finder scopes displayed quantity/price to one source and invalidates stale work", () => {
  const finder = readFileSync(new URL("../src/components/consignments/battery-finder.tsx", import.meta.url), "utf8");
  assert.match(finder, /const sourceQty = .*reportableSource\?\.reportable_qty/);
  assert.match(finder, /mixedPricing/);
  assert.match(finder, /finderAbortRef\.current\?\.abort\(\);[\s\S]*const requestId = \+\+finderRequestRef\.current/);
  assert.match(finder, /const data = res\.ok \? await res\.json\(\) : null;[\s\S]*isLatestFinderRequest/);
  assert.match(finder, /suppressTextSearchRef\.current = s\.label/);
});

test("return quantity subtracts pending sales/returns and recognizes definite conflicts", () => {
  assert.equal(consignmentReturnableQty({
    x_qty_remaining: 8,
    reportable_qty: 6,
    pending_reported_qty: 2,
    pending_return_qty: 3,
  }), 3);
  assert.equal(consignmentReturnableQty({
    x_qty_remaining: 8,
    returnable_qty: 2,
    pending_return_qty: 7,
  }), 2);
  assert.equal(consignmentReturnableQty({
    x_qty_remaining: 8,
    returnable_qty: null,
    pending_reported_qty: 2,
    pending_return_qty: 1,
  }), 5);
  assert.equal(isConfirmedMutationFailure(409, { code: "EXCEEDS_RETURNABLE" }), true);
  assert.equal(isConfirmedMutationFailure(409, { error: { code: "RETURN_ALREADY_PENDING" } }), true);
});

test("detail and return flows use strict actor and exact gateway payload", () => {
  const detailPage = readFileSync(new URL("../src/app/[locale]/(main)/consignments/[id]/page.tsx", import.meta.url), "utf8");
  const detailComponent = readFileSync(new URL("../src/components/consignments/consignment-detail.tsx", import.meta.url), "utf8");
  const returnForm = readFileSync(new URL("../src/components/consignments/request-return-form.tsx", import.meta.url), "utf8");
  const returnProxy = readFileSync(new URL("../src/app/api/consignments/[id]/request-return/route.ts", import.meta.url), "utf8");
  const saleProxy = readFileSync(new URL("../src/app/api/consignments/[id]/report-sale/route.ts", import.meta.url), "utf8");
  const saleButton = readFileSync(new URL("../src/components/consignments/sell-one-button.tsx", import.meta.url), "utf8");
  const reportSaleForm = readFileSync(new URL("../src/components/consignments/report-sale-form.tsx", import.meta.url), "utf8");
  const authSource = readFileSync(new URL("../src/lib/auth/auth.ts", import.meta.url), "utf8");
  const sessionCallback = authSource.slice(authSource.indexOf("async session"), authSource.indexOf("session: {"));

  assert.match(detailPage, /getConsignmentActor/);
  assert.match(detailPage, /consignmentGatewayFetch/);
  assert.equal(detailPage.includes("x-partner-id"), false);
  assert.equal(detailComponent.includes("/request-topup"), false);
  assert.equal(detailComponent.includes("replenishmentStorageKey"), false);
  assert.match(detailComponent, /replenish_product=/);
  const catalogueComponent = readFileSync(new URL("../src/components/consignments/replenishment-catalogue.tsx", import.meta.url), "utf8");
  const listComponent = readFileSync(new URL("../src/components/consignments/consignments-list.tsx", import.meta.url), "utf8");
  assert.match(catalogueComponent, /product\?\.can_replenish/);
  assert.match(catalogueComponent, /product\.available_qty/);
  assert.match(catalogueComponent, /hydratedStorageKey === storageKey/);
  assert.match(listComponent, /key=\{partnerId\}/);
  assert.match(returnForm, /qty_returning:\s*qtyNum/);
  assert.equal(/\bqty:\s*qtyNum/.test(returnForm), false);
  assert.match(returnProxy, /qty_returning:\s*Number\(row\.qty_returning\)/);
  assert.match(returnProxy, /idempotencyKey:\s*payload\.idempotency_key/);
  assert.match(saleProxy, /idempotencyKey:\s*payload\.idempotency_key/);
  assert.equal(saleButton.includes("Math.random"), false);
  assert.match(saleButton, /phase === "pending"/);
  assert.match(saleButton, /Keep both the optimistic quantity and operation key/);
  assert.equal(reportSaleForm.includes("Math.random"), false);
  assert.match(reportSaleForm, /getOrCreateMutationKey/);
  assert.equal(returnForm.includes("Math.random"), false);
  assert.equal(sessionCallback.includes("actorToken"), false);
});
