const rawApiBaseUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL =
  typeof rawApiBaseUrl === "string" && rawApiBaseUrl.trim().length > 0
    ? rawApiBaseUrl.trim().replace(/\/+$/, "")
    : "http://localhost:5000";

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
