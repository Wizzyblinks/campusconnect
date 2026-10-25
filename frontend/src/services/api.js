export const API_URL =
  import.meta.env.VITE_API_URL || "https://campus-connect-kf4f.onrender.com";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token");

  const baseUrl = API_URL.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
  const url = baseUrl + path;

  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(!isFormData && options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: "Bearer " + token } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const responseText = await response.text();

  let data = {};

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText };
  }

  if (!response.ok) {
    throw new Error(
      data.message || "Request failed with status " + response.status,
    );
  }

  return data;
}
