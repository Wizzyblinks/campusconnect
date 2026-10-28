import assert from "node:assert/strict";
import test from "node:test";
import { isConversationParticipant } from "../src/services/conversationAccess.js";

test("private conversation access is limited to listed participants", () => {
  const participants = ["student-one", "student-two"];
  assert.equal(isConversationParticipant(participants, "student-one"), true);
  assert.equal(isConversationParticipant(participants, "outsider"), false);
  assert.equal(isConversationParticipant([], "outsider"), false);
});
