import { timingSafeEqual } from "crypto";

const FLUTTERWAVE_API = "https://api.flutterwave.com/v3";

const getSecretKey = () => {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    const error = new Error("Flutterwave is not configured.");
    error.code = "FLUTTERWAVE_CONFIG_MISSING";
    throw error;
  }
  return secretKey;
};

export const flutterwaveRequest = async (endpoint, options = {}) => {
  const response = await fetch(`${FLUTTERWAVE_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.status !== "success") {
    const error = new Error(body.message || "Flutterwave request failed.");
    error.code = "FLUTTERWAVE_API_ERROR";
    error.statusCode = response.status;
    throw error;
  }
  return body.data;
};

export const initializeFlutterwaveCheckout = (checkout) =>
  flutterwaveRequest("/payments", {
    method: "POST",
    body: JSON.stringify(checkout),
  });

export const verifyFlutterwaveTransaction = (transactionId) =>
  flutterwaveRequest(`/transactions/${encodeURIComponent(transactionId)}/verify`);

export const requestFlutterwaveRefund = (transactionId, amount) =>
  flutterwaveRequest(
    `/transactions/${encodeURIComponent(transactionId)}/refund`,
    {
      method: "POST",
      body: JSON.stringify({ amount }),
    },
  );

export const isValidFlutterwaveWebhook = (providedHash) => {
  const expectedHash = process.env.FLW_WEBHOOK_SECRET_HASH;
  if (
    typeof providedHash !== "string" ||
    typeof expectedHash !== "string" ||
    expectedHash.length === 0
  ) {
    return false;
  }
  const provided = Buffer.from(providedHash);
  const expected = Buffer.from(expectedHash);
  return provided.length === expected.length &&
    cryptoTimingSafeEqual(provided, expected);
};

const cryptoTimingSafeEqual = (first, second) => {
  try {
    return timingSafeEqual(first, second);
  } catch {
    return false;
  }
};
