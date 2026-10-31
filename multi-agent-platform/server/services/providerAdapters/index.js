import { PROVIDERS } from '../../config/providers.js';
import { streamGemini } from './gemini.js';
import { streamOpenAICompatible } from './openaiCompatible.js';

/**
 * Common adapter interface:
 *   stream({ providerKey, apiKey, model, messages, maxTokens, temperature, signal, onToken })
 *     -> Promise<{ text, usage: { input, output } | null }>
 * Add a new provider by adding a registry entry (OpenAI-compatible) or a new adapter type here.
 */
export function stream({ providerKey, apiKey, ...rest }) {
  const cfg = PROVIDERS[providerKey];
  if (!cfg) throw new Error(`Unknown provider: ${providerKey}`);
  const common = { provider: cfg.label, baseURL: cfg.baseURL, apiKey, ...rest };
  if (cfg.type === 'gemini') return streamGemini(common);
  return streamOpenAICompatible({ ...common, headers: cfg.headers });
}
