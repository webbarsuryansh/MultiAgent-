import axios from 'axios';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 60000 });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use((r) => r, (err) => {
  if (err.response?.status === 401 && !String(err.config?.url).startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'));
  return Promise.reject(err);
});

export function errMsg(err) {
  const d = err.response?.data;
  if (d?.details?.[0]?.message) return `${d.error}: ${d.details[0].path ? `${d.details[0].path} ` : ''}${d.details[0].message}`;
  if (d?.error) return d.error;
  if (err.code === 'ERR_NETWORK') return 'Cannot reach the server. Check that the backend is running.';
  return err.message || 'Something went wrong';
}

export async function download(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(res.data);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
