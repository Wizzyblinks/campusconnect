import { io } from "socket.io-client";

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYjllNmIyYzMzMjA2ZmNjNmJiMmZlYSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzkxMjQ0MDc4LCJleHAiOjE3OTE4NDg4Nzh9.h4vy2dnwF7O-Cx7nypGghzU_iFK-SBshCsjeHSxUboI";

const socket = io("http://localhost:5000", {
  auth: {
    token,
  },
});

socket.on("connect", () => {
  console.log("Connected to Campus Connect Socket.IO");
  console.log("Socket ID:", socket.id);

  socket.emit("group:join", {
    groupId: "6ac4ddc24eb1306db10ac2b3",
  });
});

socket.on("group:joined", (data) => {
  console.log("GROUP JOINED:");
  console.log(data);

  console.log("SENDING MESSAGE...");

  setTimeout(() => {
    socket.emit("group:message", {
      groupId: "6ac4ddc24eb1306db10ac2b3",
      message: "Hello from Campus Connect group chat!",
    });
  }, 500);
});

socket.on("group:message", (data) => {
  console.log("GROUP MESSAGE RECEIVED:");
  console.log(data);
});

socket.on("group:error", (error) => {
  console.log("GROUP ERROR:");
  console.log(error);
});

socket.on("group:error", (error) => {
  console.log("GROUP ERROR:");
  console.log(error);
});

socket.on("connect_error", (error) => {
  console.log("Socket connection failed:");
  console.log(error.message);
});

socket.on("disconnect", () => {
  console.log("Disconnected from Socket.IO");
});

socket.on("group:message-deleted", (data) => {
  console.log("MESSAGE DELETED:");
  console.log(data);
});
