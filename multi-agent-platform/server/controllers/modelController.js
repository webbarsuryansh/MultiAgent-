import { z } from 'zod';
import Model from '../models/Model.js';
import { PROVIDERS } from '../config/providers.js';
import { listModelsForUser, getCredentials } from '../services/modelRegistry.js';
import { completeWithFallback } from '../services/aiOrchestrator.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

export const list = asyncHandler(async (req, res) => res.json({ models: await listModelsForUser(req.user) }));
export const available = asyncHandler(async (req, res) => res.json({ models: (await listModelsForUser(req.user)).filter((m) => m.usable) }));

const modelDef = z.object({
  name: z.string().trim().min(1).max(80),
  provider: z.string().refine((p) => PROVIDERS[p], 'Unknown provider'),
  modelId: z.string().trim().min(1).max(200),
  capabilities: z.array(z.enum(['chat', 'code', 'math', 'reasoning', 'creative', 'vision', 'long-context'])).default(['chat']),
  contextWindow: z.number().int().min(1000).max(10_000_000).default(8000),
  qualityTier: z.number().int().min(1).max(3).default(2),
  speedTier: z.number().int().min(1).max(3).default(2),
  pricingInformation: z.object({ inputPer1M: z.number().min(0), outputPer1M: z.number().min(0) }).default({ inputPer1M: 0, outputPer1M: 0 }),
});

export const configureSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  enabled: z.boolean().optional(),
  global: z.boolean().optional(), // admin: enable/disable for everyone
  model: modelDef.optional(),     // admin: add or update a model definition
});

export const configure = asyncHandler(async (req, res) => {
  const { id, enabled, global, model } = req.body;
  if (model) {
    if (req.user.role !== 'admin') throw new AppError('Only admins can add or edit model definitions', 403);
    const doc = await Model.findOneAndUpdate({ provider: model.provider, modelId: model.modelId }, { $set: model }, { upsert: true, new: true });
    return res.json({ model: doc });
  }
  if (!id || enabled == null) throw new AppError('Provide an id and enabled flag', 400);
  if (!(await Model.exists({ _id: id }))) throw new AppError('Model not found', 404);
  if (global) {
    if (req.user.role !== 'admin') throw new AppError('Only admins can change models for everyone', 403);
    await Model.updateOne({ _id: id }, { enabled });
  } else {
    const set = new Set((req.user.preferences.disabledModels || []).map(String));
    if (enabled) set.delete(id); else set.add(id);
    req.user.preferences.disabledModels = [...set];
    await req.user.save();
  }
  res.json({ ok: true });
});

export const check = asyncHandler(async (req, res) => {
  const [model, creds] = await Promise.all([Model.findById(req.params.id).lean(), getCredentials(req.user)]);
  if (!model) throw new AppError('Model not found', 404);
  if (!creds[model.provider]) return res.json({ ok: false, error: `No API key for ${PROVIDERS[model.provider]?.label || model.provider}` });
  const start = Date.now();
  try {
    await completeWithFallback({ candidates: [model], creds, messages: [{ role: 'user', content: 'Reply with the single word: OK' }], maxTokens: 200, timeoutMs: 15000, maxFallbacks: 0 });
    res.json({ ok: true, latencyMs: Date.now() - start });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});
