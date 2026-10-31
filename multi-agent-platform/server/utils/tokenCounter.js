// Rough estimate (~4 chars/token). Used only when a provider does not report usage.
export const estimateTokens = (text = '') => Math.ceil(String(text).length / 4);
export const estimateMessages = (messages) =>
  messages.reduce((n, m) => n + estimateTokens(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)), 0);
export const computeCost = (pricing, input = 0, output = 0) =>
  ((pricing?.inputPer1M || 0) * input + (pricing?.outputPer1M || 0) * output) / 1_000_000;
