import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { Server } from "socket.io";
import { io as createSocketClient } from "socket.io-client";
import { emitNotification } from "../src/services/notificationService.js";

test("notification events reach only the intended Socket.IO user room", async (context) => {
  const httpServer = createServer();
  const io = new Server(httpServer);
  io.on("connection", (socket) => {
    socket.join(`user:${socket.handshake.auth.userId}`);
  });
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  const recipient = createSocketClient(url, {
    auth: { userId: "recipient-1" },
    transports: ["websocket"],
  });
  const otherUser = createSocketClient(url, {
    auth: { userId: "other-user" },
    transports: ["websocket"],
  });
  context.after(() => {
    recipient.disconnect();
    otherUser.disconnect();
    return new Promise((resolve) => io.close(resolve));
  });

  await Promise.all([
    new Promise((resolve, reject) => {
      recipient.once("connect", resolve);
      recipient.once("connect_error", reject);
    }),
    new Promise((resolve, reject) => {
      otherUser.once("connect", resolve);
      otherUser.once("connect_error", reject);
    }),
  ]);
  const notification = { _id: "notification-1", title: "New like" };
  const received = new Promise((resolve) => recipient.once("notification:new", resolve));
  let receivedByOtherUser = false;
  otherUser.once("notification:new", () => {
    receivedByOtherUser = true;
  });

  emitNotification(io, "recipient-1", notification);

  assert.deepEqual(await received, { notification });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(receivedByOtherUser, false);
});
