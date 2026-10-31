import crypto from 'crypto';
import { env } from '../config/env.js';
import { completeWithFallback } from '../services/aiOrchestrator.js';
import { pickFast } from '../services/modelSelector.js';
import { GUARD, wrap, extractJSON } from '../utils/security.js';

/** Keyword signals per built-in agent: [pattern, weight]. Custom agents match on supportedTasks/name. */
const SIGNALS = {
  coding: [[/\b(code|coding|function|bug|debug|stack ?trace|exception|api|react|node(js)?|express|python|javascript|typescript|java|c\+\+|golang|rust|sql|regex|script|component|html|css|git|docker|algorithm|mern|backend|frontend|full[- ]stack|program(ming)?|compile|npm)\b/gi, 1.5]],
  architect: [[/\b(architect(ure)?|system design|design (a|an|the) (system|platform)|scalab\w+|microservices?|mern|full[- ]stack|high[- ]level design|infrastructure|monolith)\b/gi, 2], [/\b(create|build|implement|develop|design)\b.{0,40}\b(system|platform|app(lication)?|website|backend)\b/gi, 1.5]],
  security: [[/\b(security|secure|vulnerab\w+|auth(entication|orization)?|jwt|password|encrypt\w*|xss|csrf|sql injection|owasp|token|oauth|session|hash(ing)?|cors|pentest)\b/gi, 2]],
  database: [[/\b(database|schema|mongo(db)?|mongoose|sql|postgres|mysql|query|queries|index(es|ing)?|orm|nosql|redis|mern)\b/gi, 1.5]],
  reviewer: [[/\b(review|refactor|code quality|best practices|clean code|code smell|improve (this|my) code)\b/gi, 2], [/\b(create|build|implement|generate)\b.{0,40}\b(complete|full|entire)\b/gi, 1.2]],
  math: [[/\b(solve|equation|integral|derivative|calculus|algebra|geometry|probability|statistics|theorem|proof|matrix|calculate|formula|compound interest|percent(age)?)\b/gi, 2], [/\d+\s*[+\-*/^×÷]\s*\d+/g, 2]],
  finance: [[/\b(interest|invest\w*|loan|mortgage|stocks?|portfolio|compound|roi|inflation|budget|tax(es)?|dividend|retirement|equity|valuation|financial)\b/gi, 2]],
  business: [[/\b(startup|business|market(ing)?|strategy|revenue|pricing|customers?|go[- ]to[- ]market|competitors?|saas|monetiz\w+|b2b|pitch|growth)\b/gi, 2]],
  creative: [[/\b(story|poem|script|slogan|advert\w*|ad copy|lyrics|character|plot|brainstorm|name ideas|creative|write (a|an|me)|screenplay|tagline|novel)\b/gi, 2]],
  education: [[/\b(explain|teach|learn(ing)?|lesson|quiz|notes|roadmap|beginner|eli5|syllabus|study|understand|tutorial|curriculum|what is|how (does|do))\b/gi, 1.5]],
  research: [[/\b(research|compare|comparison|history of|latest|overview|summari[sz]e|pros and cons|facts about|impact of|why (did|is|are|was)|trends?|in 20\d\d)\b/gi, 1.5]],
};

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const cacheGet = (k) => { const e = cache.get(k); if (e && Date.now() - e.at < CACHE_TTL) return e.v; cache.delete(k); return null; };
const cacheSet = (k, v) => { if (cache.size > 500) cache.delete(cache.keys().next().value); cache.set(k, { v, at: Date.now() }); };

export function estimateComplexity(prompt) {
  const words = prompt.trim().split(/\s+/).length;
  if (/\b(complete|full|end[- ]to[- ]end|production|step by step|detailed|comprehensive|architecture)\b/i.test(prompt) || words > 45) return 'high';
  return words <= 12 ? 'low' : 'medium';
}

function heuristicRoute(prompt, agents, limit) {
  const scores = agents.map((a) => {
    let score = 0;
    const hits = [];
    for (const [re, w] of SIGNALS[a.key] || []) {
      const m = prompt.match(re);
      if (m) { score += Math.min(m.length, 3) * w; hits.push(m[0].toLowerCase()); }
    }
    if (!a.builtIn) {
      for (const t of a.supportedTasks || []) if (t && prompt.toLowerCase().includes(t.toLowerCase())) { score += 3; hits.push(t); }
    }
    return { key: a.key, score, hits };
  }).filter((s) => s.score >= 1.5 && s.key !== 'general').sort((a, b) => b.score - a.score);

  const complexity = estimateComplexity(prompt);
  const cap = Math.max(1, Math.min(limit, complexity === 'low' ? 3 : limit));
  const chosen = scores.slice(0, cap);
  const keys = chosen.length ? chosen.map((s) => s.key) : ['general'];
  return {
    agents: keys, complexity, domain: chosen[0]?.key || 'general', intent: '',
    reasoning: chosen.length ? `Matched ${chosen.map((s) => `${s.key} (${[...new Set(s.hits)].slice(0, 3).join(', ')})`).join('; ')}` : 'No specialised topic detected, so the general assistant answers.',
    method: 'heuristic',
  };
}

/**
 * Analyse the prompt and choose agents. Tries a fast LLM classifier first (if enabled and a
 * model is available) and falls back to keyword scoring. Results are cached for 10 minutes.
 */
export async function routeAgents({ prompt, agents, user, models, creds, signal }) {
  const prefs = user.preferences || {};
  const limit = Math.min(prefs.maxAgents || 4, env.maxAgentsHardLimit);
  const valid = new Set(agents.map((a) => a.key));
  const ck = crypto.createHash('sha1').update(`${prompt.toLowerCase().trim()}|${[...valid].sort().join(',')}|${limit}`).digest('hex');
  const hit = cacheGet(ck);
  if (hit) return { ...hit, cached: true };

  const heur = heuristicRoute(prompt, agents, limit);
  let result = heur;

  if (env.routerUseLLM && models.length) {
    try {
      const best = pickFast(models);
      const fast = [best, ...models.filter((m) => m !== best)];
      const messages = [
        { role: 'system', content: `You are the routing layer of a multi-agent AI system. Pick the smallest set of agents that gives the best answer (1 to ${limit}; simple questions need only one). Return JSON only: {"agents":["key",...],"intent":"short","complexity":"low|medium|high","domain":"short","reasoning":"one sentence"}.\n\nAgents:\n${agents.map((a) => `- ${a.key}: ${a.description}`).join('\n')}\n\n${GUARD}` },
        { role: 'user', content: wrap('user_document', 'name="request"', prompt.slice(0, 3000)) },
      ];
      const r = await completeWithFallback({ candidates: fast, creds, messages, signal, maxTokens: 400, timeoutMs: 12000, temperature: 0, maxFallbacks: 1 });
      const json = extractJSON(r.text);
      const keys = [...new Set((json?.agents || []).filter((k) => valid.has(k)))].slice(0, limit);
      if (keys.length) {
        result = {
          agents: keys, complexity: ['low', 'medium', 'high'].includes(json.complexity) ? json.complexity : heur.complexity,
          domain: String(json.domain || heur.domain).slice(0, 40), intent: String(json.intent || '').slice(0, 120),
          reasoning: String(json.reasoning || '').slice(0, 240) || heur.reasoning, method: 'llm',
        };
      }
    } catch (err) {
      if (err.cancelled) throw err;
      /* fall back to heuristic */
    }
  }
  cacheSet(ck, result);
  return result;
}
