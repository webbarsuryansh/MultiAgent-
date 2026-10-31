import { readSSE } from './sse.js';
import { httpError, wrapNetworkError } from './errors.js';

const toContent = (m) => {
  if (!m.images?.length) return m.content;
  return [
    { type: 'text', text: m.content },
    ...m.images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } })),
  ];
};

/** Streams a chat completion from any OpenAI-compatible endpoint. */
export async function streamOpenAICompatible({ provider, baseURL, apiKey, model, messages, maxTokens, temperature, signal, onToken, headers = {} }) {
  let text = '';
  let usage = null;
  try {
    const res = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...headers },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: toContent(m) })),
        max_tokens: maxTokens,
        temperature,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });
    if (!res.ok) throw await httpError(res, provider);
    for await (const data of readSSE(res)) {
      if (data === '[DONE]') break;
      let json;
      try { json = JSON.parse(data); } catch { continue; }
      if (json.error) throw wrapNetworkError(new Error(json.error.message || 'Stream error'), signal);
      const delta = json.choices?.[0]?.delta?.content;
      if (delta) { text += delta; onToken?.(delta); }
      if (json.usage) usage = { input: json.usage.prompt_tokens, output: json.usage.completion_tokens };
    }
    return { text, usage };
  } catch (err) {
    throw wrapNetworkError(err, signal);
  }
}
