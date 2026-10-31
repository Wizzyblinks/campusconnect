import assert from "node:assert/strict";
import test from "node:test";
import { createSellerEligibilityLookup } from "../src/services/sellerEligibility.js";

const makeLookup = ({ application = null, listingHistory = false, orderHistory = false } = {}) => {
  const queries = [];
  const lookup = createSellerEligibilityLookup({
    sellerApplications: {
      findOne: (filter) => ({
        select: () => ({
          lean: async () => {
            queries.push(["application", filter]);
            return application;
          },
        }),
      }),
    },
    marketplaceListings: {
      exists: async (filter) => {
        queries.push(["listing", filter]);
        return listingHistory;
      },
    },
    orders: {
      exists: async (filter) => {
        queries.push(["order", filter]);
        return orderHistory;
      },
    },
  });
  return { lookup, queries };
};

test("approved applications remain eligible without active listing history", async () => {
  const { lookup } = makeLookup({ application: { status: "APPROVED" } });
  assert.deepEqual(await lookup("seller-1"), {
    eligible: true,
    legacySeller: false,
    application: { status: "APPROVED" },
  });
});

test("unapproved applications take precedence over historical seller activity", async () => {
  for (const status of ["PENDING", "REJECTED", "SUSPENDED"]) {
    const { lookup, queries } = makeLookup({
      application: { status },
      listingHistory: true,
      orderHistory: true,
    });
    const result = await lookup("seller-1");
    assert.equal(result.eligible, false);
    assert.equal(result.legacySeller, false);
    assert.equal(queries.some(([kind]) => kind === "listing" || kind === "order"), false);
  }
});

test("legacy seller history qualifies regardless of current listing state", async () => {
  for (const history of [{ listingHistory: true }, { orderHistory: true }]) {
    const { lookup, queries } = makeLookup(history);
    const result = await lookup("seller-1");
    assert.equal(result.eligible, true);
    assert.equal(result.legacySeller, true);
    assert.equal(result.application, null);
    assert.deepEqual(queries.find(([kind]) => kind === "listing")?.[1], { seller: "seller-1" });
    assert.deepEqual(queries.find(([kind]) => kind === "order")?.[1], { seller: "seller-1" });
  }
});

test("users without an application or seller history are not automatically eligible", async () => {
  const { lookup } = makeLookup();
  assert.deepEqual(await lookup("buyer-1"), {
    eligible: false,
    legacySeller: false,
    application: null,
  });
});
