import express from "express";

import cors from "cors";

import helmet from "helmet";

import morgan from "morgan";

import authRoutes from "./routes/authRoutes.js";

import protect from "./middleware/authMiddleware.js";

import institutionRoutes from "./routes/institutionRoutes.js";

import profileRoutes from "./routes/profileRoutes.js";

import newsRoutes from "./routes/newsRoutes.js";

import verificationRoutes from "./routes/verificationRoutes.js";

import marketplaceRoutes from "./routes/marketplaceRoutes.js";

import orderRoutes from "./routes/orderRoutes.js";

import paymentRoutes from "./routes/paymentRoutes.js";

import deliveryRoutes from "./routes/deliveryRoutes.js";

import disputeRoutes from "./routes/disputeRoutes.js";

import groupRoutes from "./routes/groupRoutes.js";

import path from "path";

import messageRoutes from "./routes/messageRoutes.js";
import payoutRoutes from "./routes/payoutRoutes.js";
import matchingRoutes from "./routes/matchingRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import discoveryRoutes from "./routes/discoveryRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import followRoutes from "./routes/followRoutes.js";

const app = express();

app.use("/uploads", express.static(path.resolve("uploads")));

app.use(cors());

app.use(helmet());

app.use(morgan("dev"));

app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/institutions", institutionRoutes);

app.use("/api/profile", profileRoutes);

app.use("/api/news", newsRoutes);

app.use("/api/posts", postRoutes);

app.use("/api/discovery", discoveryRoutes);

app.use("/api/search", searchRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/follows", followRoutes);

app.use("/api/verification", verificationRoutes);

app.use("/api/marketplace", marketplaceRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/delivery", deliveryRoutes);

app.use("/api/disputes", disputeRoutes);

app.use("/api/groups", groupRoutes);

app.use("/api/messages", messageRoutes);

app.use("/api/payouts", payoutRoutes);

app.use("/api/matching", matchingRoutes);

app.use("/api/services", serviceRoutes);

app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Campus Connect API is running",
  });
});

app.get("/api/auth/me", protect, (req, res) => {
  res.json({
    user: req.user,
  });
});

export default app;
