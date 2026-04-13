const normalizeBase = (value) => String(value || '').trim().replace(/\/+$/, '');
const normalizePath = (value) => String(value || '').trim().replace(/^\/+/, '');
const ensureApiPath = (value) => {
  const normalized = normalizeBase(value);
  if (!normalized) return '';
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
const API_BASE_URL =
  normalizeBase(env?.VITE_API_BASE_URL) ||
  ensureApiPath(env?.VITE_API_URL) ||
  (env?.DEV ? '/api' : 'https://prime-printing-service.onrender.com/api');
const BASE_URL = API_BASE_URL;

const getUrl = (path = '') => {
  const rawPath = String(path || '').trim();
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const base = normalizeBase(API_BASE_URL);
  let cleanedPath = normalizePath(rawPath);
  if (!base && !cleanedPath) return '';
  if (!base) return cleanedPath ? `/${cleanedPath}` : '';
  if (base.endsWith('/api') && cleanedPath.startsWith('api/')) {
    cleanedPath = cleanedPath.slice(4);
  }
  if (!cleanedPath) return base;
  return `${base}/${cleanedPath}`;
};

if (typeof window !== 'undefined') {
  window.getApiUrl = getUrl;
  window.API_BASE_URL = API_BASE_URL;
  window.BASE_URL = BASE_URL;
}

export { API_BASE_URL, BASE_URL, getUrl };
