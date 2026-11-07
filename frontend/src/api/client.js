import axios from "axios";

// Relative by default so the same build works behind any reverse proxy
// (nginx `/api` -> backend, Vercel rewrite, Vite dev proxy, ...).
// Override with VITE_API_URL when the API lives on another domain.
const API_URL = import.meta.env.VITE_API_URL || "/api";

// When the API lives on another origin (Vercel frontend + Railway API), the
// paths returned by /api/uploads are relative to that API, not to the page.
const API_ORIGIN_WITH_PATH = /^https?:\/\//i.test(API_URL) ? API_URL.replace(/\/api\/?$/, "") : "";

/** Turns "/api/uploads/x.png" into an absolute URL when the API is remote. */
export function assetUrl(url) {
  if (!url) return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (API_ORIGIN_WITH_PATH && url.startsWith("/")) return `${API_ORIGIN_WITH_PATH}${url}`;
  return url;
}

export const api = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = null;

/** Lets the auth layer react globally (e.g. redirect to the login screen). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(err);
  }
);

/** Human readable message for any axios/API failure. */
export function apiErrorMessage(err, fallback = "حدث خطأ غير متوقع، حاول مرة أخرى.") {
  return err?.response?.data?.error || fallback;
}
