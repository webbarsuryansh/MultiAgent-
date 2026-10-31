import { z } from 'zod';
import Agent from '../models/Agent.js';
import { getUsableModels, getCredentials } from '../services/modelRegistry.js';
import { rankModels } from '../services/modelSelector.js';
import { evaluateResponses, synthesize } from '../services/responseEvaluator.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

export const bodySchema = z.object({
  prompt: z.string().trim().min(1).max(20000),
  responses: z.array(z.object({ id: z.string().max(100), name: z.string().max(80).default('Agent'), content: z.string().min(1).max(20000) })).min(1).max(8),
});

async function setup(req, key) {
  const [models, creds, agent] = await Promise.all([getUsableModels(req.user), getCredentials(req.user), Agent.findOne({ key }).lean()]);
  if (!models.length) throw new AppError('No models are available. Add an API key first.', 400);
  const prefs = req.user.preferences.toObject();
  return { candidates: rankModels({ agent, models, user: req.user, strategy: 'quality' }), creds, agent, prefs };
}

export const evaluate = asyncHandler(async (req, res) => {
  const { candidates, creds, agent, prefs } = await setup(req, 'critic');
  const responses = req.body.responses.map((r) => ({ key: r.id, name: r.name, content: r.content }));
  const out = await evaluateResponses({ prompt: req.body.prompt, responses, criticAgent: agent, candidates, creds, prefs });
  res.json({ evaluations: out.evaluations, summary: out.summary, judge: out.model.name, note: 'Scores are AI-judged opinions, not verified facts.' });
});

export const synth = asyncHandler(async (req, res) => {
  const { candidates, creds, agent, prefs } = await setup(req, 'synthesizer');
  const responses = req.body.responses.map((r) => ({ key: r.id, name: r.name, content: r.content }));
  const r = await synthesize({ prompt: req.body.prompt, responses, synthAgent: agent, candidates, creds, prefs });
  res.json({ content: r.text, model: r.model.name, tokens: r.usage, cost: r.cost });
});
