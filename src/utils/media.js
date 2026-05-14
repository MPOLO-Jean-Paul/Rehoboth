import api from '../services/api';

const apiOrigin = () => {
  try {
    const parsed = new URL(api.defaults.baseURL);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/api\/?$/, '')}`;
  } catch {
    return '';
  }
};

export function resolveMediaUrl(value) {
  if (!value) return null;

  const rawUrl = String(value).trim();
  if (!rawUrl) return null;

  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const media = new URL(rawUrl);
      const api = new URL(api.defaults.baseURL);

      if (media.host !== api.host && (media.pathname.includes('/storage/') || media.pathname.includes('/media/'))) {
        const marker = media.pathname.includes('/media/') ? '/media/' : '/storage/';
        const storagePath = media.pathname.slice(media.pathname.indexOf(marker));
        return `${apiOrigin()}${storagePath}`;
      }
    } catch {
      return rawUrl;
    }

    return rawUrl;
  }

  const cleanPath = rawUrl
    .replace(/^public\//, '')
    .replace(/^storage\//, '');

  return `${apiOrigin()}/media/${cleanPath}`;
}

export function withCacheBust(url, version = Date.now()) {
  const resolved = resolveMediaUrl(url);
  if (!resolved) return null;

  const separator = resolved.includes('?') ? '&' : '?';
  return `${resolved}${separator}t=${new Date(version || Date.now()).getTime()}`;
}
