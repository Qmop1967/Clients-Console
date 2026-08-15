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
  replenishmentStorageKey,
  replenishmentSubmissionHash,
  setReplenishmentQuantity,
  unlockAfterConfirmedFailure,
} from "../src/lib/consignments/replenishment-cart.ts";

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
