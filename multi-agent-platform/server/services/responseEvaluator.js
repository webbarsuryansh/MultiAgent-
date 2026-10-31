import { completeWithFallback } from './aiOrchestrator.js';
import { GUARD, wrap, extractJSON } from '../utils/security.js';
import { AppError } from '../utils/AppError.js';

export const CRITERIA = ['accuracy', 'relevance', 'completeness', 'clarity', 'reasoning', 'instruction'];
const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const attr = (s) => String(s).replace(/["<>]/g, '');

/**
 * Critic pass. IMPORTANT: scores are one model's opinion, not verification. The critic is told to
 * penalize unverifiable claims, and the UI labels scores as AI-judged. Prefer a model different
 * from the answering models (the selector penalises already-used models for this reason).
 */
export async function evaluateResponses({ prompt, responses, criticAgent, candidates, creds, prefs, signal }) {
  const messages = [
    { role: 'system', content: `${criticAgent.systemPrompt}\n\n${GUARD}` },
    { role: 'user', content: `User request:\n${wrap('user_document', 'name="request"', prompt)}\n\nAnswers to evaluate:\n${responses.map((r) => wrap('agent_output', `id="${attr(r.key)}" by="${attr(r.name)}"`, r.content.slice(0, 6000))).join('\n')}\n\nScore EVERY answer from 0 to 100 on: ${CRITERIA.join(', ')} ("instruction" = adherence to the request). Be strict and do not reward length. You cannot verify facts without sources, so lower accuracy for unverifiable or suspicious claims and list them under issues. Return JSON only:\n{"evaluations":[{"id":"<id>","scores":{"accuracy":0,"relevance":0,"completeness":0,"clarity":0,"reasoning":0,"instruction":0},"overall":0,"explanation":"1-2 sentences","issues":["..."]}],"summary":"2-3 sentences comparing the answers, noting contradictions or likely hallucinations"}` },
  ];
  const r = await completeWithFallback({ candidates, creds, messages, signal, maxTokens: Math.max(prefs.maxTokens, 1800), timeoutMs: prefs.timeoutMs, temperature: 0.2, maxFallbacks: 1 });
  const json = extractJSON(r.text);
  if (!json?.evaluations?.length) throw new AppError('The critic returned an unreadable evaluation', 502);

  const evaluations = {};
  for (const e of json.evaluations) {
    if (!responses.some((x) => x.key === e.id)) continue;
    const scores = Object.fromEntries(CRITERIA.map((c) => [c, clamp(e.scores?.[c])]));
    const overall = e.overall != null ? clamp(e.overall) : clamp(Object.values(scores).reduce((a, b) => a + b, 0) / CRITERIA.length);
    evaluations[e.id] = { scores, overall, explanation: String(e.explanation || '').slice(0, 500), issues: (e.issues || []).slice(0, 6).map((i) => String(i).slice(0, 200)) };
  }
  return { evaluations, summary: String(json.summary || '').slice(0, 800), model: r.model, usage: r.usage, cost: r.cost };
}

export async function synthesize({ prompt, responses, evaluations = {}, summary = '', synthAgent, candidates, creds, prefs, signal, onToken, onAttempt }) {
  const block = responses.map((r) => {
    const ev = evaluations[r.key];
    return wrap('agent_output', `by="${attr(r.name)}"${ev ? ` critic_score="${ev.overall}"` : ''}`, `${r.content.slice(0, 6000)}${ev?.issues?.length ? `\n[Critic flagged: ${ev.issues.join('; ')}]` : ''}`);
  }).join('\n');
  const messages = [
    { role: 'system', content: `${synthAgent.systemPrompt}\n\n${GUARD}` },
    { role: 'user', content: `User request:\n${wrap('user_document', 'name="request"', prompt)}\n\nAnswers from different agents:\n${block}\n\n${summary ? `Critic summary: ${summary}\n\n` : ''}Write the single best final answer for the user in Markdown. Merge the strongest correct points, remove repetition, resolve disagreements where the evidence allows (otherwise note them briefly), and drop claims the critic flagged. Do not mention agents or scores unless a disagreement matters to the user.` },
  ];
  return completeWithFallback({ candidates, creds, messages, signal, maxTokens: Math.max(prefs.maxTokens, 1800), timeoutMs: prefs.timeoutMs, temperature: 0.4, onToken, onAttempt, maxFallbacks: 1 });
}
