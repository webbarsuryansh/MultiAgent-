import { z } from 'zod';
import Message from '../models/Message.js';
import { asyncHandler } from '../utils/AppError.js';
import { env } from '../config/env.js';

const id24 = z.string().regex(/^[a-f\d]{24}$/i);
export const prefsSchema = z.object({
  maxTokens: z.number().int().min(100).max(8000),
  timeoutMs: z.number().int().min(5000).max(180000),
  maxAgents: z.number().int().min(1).max(env.maxAgentsHardLimit),
  collaborationRounds: z.number().int().min(1).max(env.maxCollabRounds),
  selectionStrategy: z.enum(['balanced', 'quality', 'speed', 'cost']),
  maxCostPer1M: z.number().min(0).nullable(),
  enableCritic: z.boolean(),
  enableSynthesizer: z.boolean(),
  agentModels: z.record(z.string().max(60), id24.or(z.literal(''))),
}).partial();

export const updatePreferences = asyncHandler(async (req, res) => {
  const { agentModels, ...rest } = req.body;
  Object.assign(req.user.preferences, rest);
  if (agentModels) {
    const map = new Map(req.user.preferences.agentModels || []);
    for (const [k, v] of Object.entries(agentModels)) { if (v) map.set(k, v); else map.delete(k); }
    req.user.preferences.agentModels = map;
  }
  await req.user.save();
  res.json({ user: req.user.toPublic() });
});

export const usage = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const since = new Date(Date.now() - days * 86400000);
  const base = [{ $match: { userId: req.user._id, createdAt: { $gte: since } } }];
  const calls = [...base, { $unwind: '$agentResponses' }, { $match: { 'agentResponses.status': 'completed' } },
    { $addFields: { tk: { $add: [{ $ifNull: ['$agentResponses.tokens.input', 0] }, { $ifNull: ['$agentResponses.tokens.output', 0] }] }, cs: { $ifNull: ['$agentResponses.cost', 0] } } }];
  const group = (id) => [{ $group: { _id: id, calls: { $sum: 1 }, tokens: { $sum: '$tk' }, cost: { $sum: '$cs' }, latency: { $avg: '$agentResponses.latencyMs' } } }, { $sort: { _id: 1 } }];

  const [byDay, byProvider, byAgent, byModel, finals, turns] = await Promise.all([
    Message.aggregate([...calls, ...group({ $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } })]),
    Message.aggregate([...calls, ...group('$agentResponses.provider')]),
    Message.aggregate([...calls, ...group('$agentResponses.agentName')]),
    Message.aggregate([...calls, ...group('$agentResponses.modelName')]),
    Message.aggregate([...base, { $match: { 'finalResponse.status': 'completed' } }, { $group: { _id: null, calls: { $sum: 1 }, tokens: { $sum: { $add: [{ $ifNull: ['$finalResponse.tokens.input', 0] }, { $ifNull: ['$finalResponse.tokens.output', 0] }] } }, cost: { $sum: { $ifNull: ['$finalResponse.cost', 0] } } } }]),
    Message.countDocuments({ userId: req.user._id, createdAt: { $gte: since } }),
  ]);
  const sum = (rows, k) => rows.reduce((n, r) => n + (r[k] || 0), 0);
  const f = finals[0] || { calls: 0, tokens: 0, cost: 0 };
  const clean = (rows) => rows.map((r) => ({ name: r._id, calls: r.calls, tokens: r.tokens, cost: r.cost, avgLatencyMs: Math.round(r.latency || 0) }));
  res.json({
    days,
    totals: { prompts: turns, modelCalls: sum(byDay, 'calls') + f.calls, tokens: sum(byDay, 'tokens') + f.tokens, cost: sum(byDay, 'cost') + f.cost },
    byDay: clean(byDay), byProvider: clean(byProvider), byAgent: clean(byAgent), byModel: clean(byModel),
    note: 'Costs are estimates from the pricing stored on each model and may differ from your provider invoice.',
  });
});
