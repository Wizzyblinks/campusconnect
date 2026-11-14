import { requestFlutterwaveRefund } from "./flutterwaveService.js";

const PAYSTACK_API = "https://api.paystack.co";

const requestPaystackRefund = async (reference, amount) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    const error = new Error("Historical Paystack refunds are not configured.");
    error.code = "PAYSTACK_CONFIG_MISSING";
    throw error;
  }
  const response = await fetch(`${PAYSTACK_API}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transaction: reference,
      amount: Math.round(amount * 100),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.status) {
    const error = new Error(body.message || "Historical Paystack refund failed.");
    error.code = "PAYSTACK_REFUND_ERROR";
    error.statusCode = response.status;
    throw error;
  }
  return body.data;
};

export const requestProviderRefund = (payment, amount) => {
  if (payment.provider === "FLUTTERWAVE") {
    if (!payment.providerTransactionId) {
      const error = new Error("Flutterwave transaction ID is unavailable for refund.");
      error.code = "FLUTTERWAVE_TRANSACTION_ID_MISSING";
      throw error;
    }
    return requestFlutterwaveRefund(payment.providerTransactionId, amount);
  }
  if (payment.provider === "PAYSTACK" || !payment.provider) {
    return requestPaystackRefund(payment.reference, amount);
  }
  const error = new Error("Refunds are not supported for this payment provider.");
  error.code = "PAYMENT_PROVIDER_UNSUPPORTED";
  throw error;
};
