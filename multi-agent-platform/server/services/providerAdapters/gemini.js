import { readSSE } from './sse.js';
import { httpError, wrapNetworkError } from './errors.js';

/** Streams a response from the Google Gemini API (streamGenerateContent, SSE). */
export async function streamGemini({ provider = 'Gemini', baseURL, apiKey, model, messages, maxTokens, temperature, signal, onToken }) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }, ...(m.images || []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } }))],
  }));
  let text = '';
  let usage = null;
  try {
    const res = await fetch(`${baseURL}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    });
    if (!res.ok) throw await httpError(res, provider);
    for await (const data of readSSE(res)) {
      let json;
      try { json = JSON.parse(data); } catch { continue; }
      if (json.error) throw wrapNetworkError(new Error(json.error.message || 'Stream error'), signal);
      const parts = json.candidates?.[0]?.content?.parts || [];
      for (const p of parts) if (p.text && !p.thought) { text += p.text; onToken?.(p.text); }
      if (json.usageMetadata) usage = { input: json.usageMetadata.promptTokenCount, output: (json.usageMetadata.candidatesTokenCount || 0) + (json.usageMetadata.thoughtsTokenCount || 0) };
      const blocked = json.promptFeedback?.blockReason;
      if (blocked) throw wrapNetworkError(new Error(`Gemini blocked the prompt (${blocked})`), signal);
    }
    return { text, usage };
  } catch (err) {
    throw wrapNetworkError(err, signal);
  }
}
