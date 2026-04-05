const ENV_API_URL = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
const IS_LOCALHOST_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(ENV_API_URL);

export const API_BASE_URL = import.meta.env.PROD
  ? ENV_API_URL && !IS_LOCALHOST_URL
    ? ENV_API_URL
    : ""
  : ENV_API_URL || "http://localhost:5000";

export function buildApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;

  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export function getSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) {
    return String(import.meta.env.VITE_SOCKET_URL).trim();
  }

  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "http://localhost:5000";
}

export async function fetchJson(urlOrPath, init) {
  const url = /^https?:\/\//i.test(String(urlOrPath || ""))
    ? String(urlOrPath)
    : buildApiUrl(urlOrPath);

  const response = await fetch(url, init);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed (${response.status})`);
  }

  return response.json();
}
