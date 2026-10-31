const STRATEGY = {
  balanced: { quality: 1, speed: 1, cost: 1 },
  quality: { quality: 2.2, speed: 0.4, cost: 0.3 },
  speed: { quality: 0.5, speed: 2.2, cost: 0.5 },
  cost: { quality: 0.5, speed: 0.5, cost: 2.2 },
};

const avgPrice = (m) => ((m.pricingInformation?.inputPer1M || 0) + (m.pricingInformation?.outputPer1M || 0)) / 2;
const costScore = (m) => { const p = avgPrice(m); return p === 0 ? 3 : p < 0.5 ? 2.6 : p < 2 ? 2 : p < 8 ? 1 : 0.3; };

/**
 * Rank usable models for an agent. Considers: capabilities, user/agent preference, strategy
 * (quality / speed / cost), the configured cost ceiling and a diversity penalty so different
 * agents tend to land on different models.
 *
 * @returns models sorted best-first (callers use the tail as fallbacks)
 */
export function rankModels({ agent, models, user, usage = {}, needsVision = false, strategy, exclude = [] }) {
  const prefs = user.preferences || {};
  const w = STRATEGY[strategy || prefs.selectionStrategy] || STRATEGY.balanced;
  const preferredId = prefs.agentModels?.get?.(agent.key) || prefs.agentModels?.[agent.key] || (agent.preferredModel && String(agent.preferredModel)) || null;

  let pool = models.filter((m) => !exclude.includes(String(m._id)));
  if (needsVision) pool = pool.filter((m) => m.capabilities?.includes('vision'));
  if (prefs.maxCostPer1M != null) {
    const cheap = pool.filter((m) => avgPrice(m) <= prefs.maxCostPer1M);
    if (cheap.length) pool = cheap;
  }

  const need = agent.requiredCapabilities?.length ? agent.requiredCapabilities : ['chat'];
  return pool
    .map((m) => {
      const matched = need.filter((c) => m.capabilities?.includes(c)).length / need.length;
      let score = matched * 3 + m.qualityTier * w.quality + m.speedTier * w.speed + costScore(m) * w.cost;
      if (preferredId && String(m._id) === String(preferredId)) score += 6;
      score -= (usage[String(m._id)] || 0) * 1.2;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}

/** Fastest/cheapest usable model, for lightweight jobs like routing. */
export const pickFast = (models) => [...models].sort((a, b) => (b.speedTier * 2 + costScore(b)) - (a.speedTier * 2 + costScore(a)))[0];
