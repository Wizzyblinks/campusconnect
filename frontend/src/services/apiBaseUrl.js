const PRODUCTION_API_URL = "https://campus-connect-kf4f.onrender.com";

export function getApiBaseUrl(configuredUrl, isDevelopment) {
  const fallback = isDevelopment ? "http://localhost:5000" : PRODUCTION_API_URL;
  return (configuredUrl?.trim() || fallback)
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");
}
