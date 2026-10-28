import assert from "node:assert/strict";
import test from "node:test";
import { notificationOwnerFilter } from "../src/services/notificationService.js";

test("notification lookups are scoped to both notification and recipient", () => {
  const notificationId = "notification-1";
  const recipientId = "user-1";

  assert.deepEqual(notificationOwnerFilter(recipientId, notificationId), {
    _id: notificationId,
    recipient: recipientId,
  });
  assert.notDeepEqual(
    notificationOwnerFilter("user-2", notificationId),
    notificationOwnerFilter(recipientId, notificationId),
  );
});
