import {
  getResponseMessage,
  isSafeUserMessage,
  NETWORK_ERROR,
  SERVER_ERROR,
} from "./errorMessages.js";
import { getApiBaseUrl } from "./apiBaseUrl.js";

export const API_URL = getApiBaseUrl(
  import.meta.env?.VITE_API_URL,
  import.meta.env?.DEV,
);

export const SESSION_EXPIRED_EVENT = "campus-connect:session-expired";

const publicEndpoints = new Set([
  "/api/institutions",
  "/api/auth/register",
  "/api/auth/verify-signup-otp",
  "/api/auth/resend-signup-otp",
  "/api/auth/request-password-reset",
  "/api/auth/verify-password-reset-otp",
  "/api/auth/resend-password-reset-otp",
  "/api/auth/reset-password",
  "/api/auth/login",
]);

export function getTokenExpiration(token) {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return Number.isFinite(payload.exp) ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token, now = Date.now()) {
  const expiration = getTokenExpiration(token);
  return expiration === null || expiration <= now;
}

export function expireSession(token) {
  if (!token || localStorage.getItem("token") !== token) return false;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return true;
}

export class ApiRequestError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export function getFriendlyErrorMessage(error, fallback = SERVER_ERROR) {
  if (error instanceof ApiRequestError) return error.message;
  if (error?.name === "AbortError") {
    return "The request took too long. Please try again.";
  }
  if (error instanceof TypeError) return NETWORK_ERROR;
  return isSafeUserMessage(error?.message) ? error.message : fallback;
}

export async function apiRequest(endpoint, options = {}) {
  const baseUrl = API_URL.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
  const url = baseUrl + path;
  const publicRequest = publicEndpoints.has(path.replace(/\/+$/, ""));
  const token = localStorage.getItem("token");

  if (token && !publicRequest && isTokenExpired(token)) {
    expireSession(token);
    throw new ApiRequestError(
      "Your session has expired. Please log in again.",
      401,
    );
  }

  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(!isFormData && options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token && !publicRequest ? { Authorization: "Bearer " + token } : {}),
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const externalSignal = options.signal;
  const forwardAbort = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener("abort", forwardAbort, { once: true });

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiRequestError(
      error?.name === "AbortError" && !externalSignal?.aborted
        ? "The request took too long. Please try again."
        : getFriendlyErrorMessage(error, NETWORK_ERROR),
    );
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", forwardAbort);
  }

  let responseText;
  try {
    responseText = await response.text();
  } catch (error) {
    throw new ApiRequestError(getFriendlyErrorMessage(error, NETWORK_ERROR));
  }

  let data = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    if (responseText) {
      throw new ApiRequestError(SERVER_ERROR, response.status);
    }
  }

  if (!response.ok) {
    if (response.status === 401 && token && !publicRequest) {
      expireSession(token);
    }
    throw new ApiRequestError(
      getResponseMessage(response.status, data.message, path),
      response.status,
    );
  }

  return data;
}
