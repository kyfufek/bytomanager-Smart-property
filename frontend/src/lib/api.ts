import { supabase } from "@/lib/supabase";

const rawApiBaseUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL =
  typeof rawApiBaseUrl === "string" && rawApiBaseUrl.trim().length > 0
    ? rawApiBaseUrl.trim().replace(/\/+$/, "")
    : "http://localhost:5000";

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(buildApiUrl(path), {
    ...init,
    headers,
  });
}
