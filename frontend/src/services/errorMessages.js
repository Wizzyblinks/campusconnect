export const NETWORK_ERROR =
  "We couldn't connect to Campus Connect. Please check your internet connection and try again.";
export const SERVER_ERROR = "Something went wrong. Please try again in a moment.";

export const isSafeUserMessage = (message) =>
  typeof message === "string" &&
  message.length > 0 &&
  message.length <= 200 &&
  !/\b(stack|trace|exception|mongoose|mongodb|e11000|axios|node\.?js|internal server|secret|token|password hash|validationerror|validation failed|cast(error| to)|duplicate key|mongo(server|error)|referenceerror|typeerror|cannot read|cannot set|undefined|null|errno|econn|eai_again| at [\w./\\]+:\d+)\b/i.test(
    message,
  );

export const getResponseMessage = (status, message, endpoint) => {
  if (status === 401) {
    if (/^\/?api\/auth\/(login|verify-|resend-|request-password-reset|reset-password)/.test(endpoint) &&
        isSafeUserMessage(message)) {
      return message;
    }
    return "Your session has expired. Please log in again.";
  }
  if (status === 408 || status === 504) {
    return "The request took too long. Please try again.";
  }
  if (status === 429) {
    return "You're trying that too often. Please wait a moment and try again.";
  }
  if (status === 502 && /\/api\/posts/.test(endpoint)) {
    return "We couldn't upload your file. Please try again.";
  }
  if (status === 502 && /\/api\/marketplace/.test(endpoint)) {
    return "We couldn't upload your listing photos. Please try again.";
  }
  if (status === 502 && /\/api\/(payments|payouts)/.test(endpoint)) {
    return "The payment service is temporarily unavailable. Please try again shortly.";
  }
  if (status === 502) {
    return "Campus Connect couldn't reach a service it needs. Please try again shortly.";
  }
  if (status === 503) {
    return "Campus Connect is temporarily unavailable. Please try again shortly.";
  }
  if (status >= 500 && endpoint.replace(/\/+$/, "") === "/api/auth/login") {
    return "We couldn't sign you in right now. Please try again.";
  }
  if (status >= 500) return SERVER_ERROR;
  if (status === 404) return "We couldn't find what you requested.";
  if ((status === 400 || status === 403 || status === 409 || status === 413 || status === 415 || status === 422) &&
      isSafeUserMessage(message)) {
    return message;
  }
  return status === 0 ? NETWORK_ERROR : SERVER_ERROR;
};
