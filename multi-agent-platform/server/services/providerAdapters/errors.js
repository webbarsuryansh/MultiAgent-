export class ProviderError extends Error {
  constructor(message, { status, retryable = false, cancelled = false, timeout = false } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.retryable = retryable;
    this.cancelled = cancelled;
    this.timeout = timeout;
  }
}

export const isRetryableStatus = (s) => s === 408 || s === 409 || s === 425 || s === 429 || (s >= 500 && s < 600);

export async function httpError(res, provider) {
  let detail = '';
  try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
  let msg = detail;
  try { const j = JSON.parse(detail); msg = j.error?.message || j.message || detail; } catch { /* keep raw */ }
  const friendly = res.status === 401 || res.status === 403 ? 'rejected the API key' : res.status === 404 ? 'could not find that model' : res.status === 429 ? 'rate limit or quota reached' : `returned HTTP ${res.status}`;
  return new ProviderError(`${provider} ${friendly}${msg ? `: ${msg}` : ''}`, { status: res.status, retryable: isRetryableStatus(res.status) });
}

export function wrapNetworkError(err, signal) {
  if (err instanceof ProviderError) return err;
  if (signal?.aborted || err?.name === 'AbortError' || err?.name === 'TimeoutError') {
    const timeout = err?.name === 'TimeoutError' || signal?.reason?.name === 'TimeoutError';
    return new ProviderError(timeout ? 'The model took too long to respond' : 'Request cancelled', { cancelled: !timeout, timeout, retryable: timeout });
  }
  return new ProviderError(`Network error: ${err.message}`, { retryable: true });
}
