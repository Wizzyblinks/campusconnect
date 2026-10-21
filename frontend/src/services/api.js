const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const url = `${API_URL}${endpoint}`;

  console.log("Request URL:", url);
  console.log("Authentication token exists:", Boolean(token));

  try {
    const isFormData = options.body instanceof FormData;
    const headers = {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const responseText = await response.text();

    console.log("HTTP status:", response.status);
    console.log("Server response:", responseText);

    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText };
    }

    if (!response.ok) {
      throw new Error(
        data.message || `Request failed with status ${response.status}`,
      );
    }

    return data;
  } catch (error) {
    console.error("API request failed:", error.message);
    throw error;
  }
}
