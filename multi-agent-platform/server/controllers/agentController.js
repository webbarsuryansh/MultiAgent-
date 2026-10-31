import crypto from 'crypto';
import { z } from 'zod';
import Agent from '../models/Agent.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

const visible = (user) => ({ $or: [{ owner: null }, { owner: user._id }] });

export const agentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  icon: z.string().max(30).optional(),
  systemPrompt: z.string().trim().min(10).max(4000),
  supportedTasks: z.array(z.string().trim().max(40)).max(12).optional(),
  requiredCapabilities: z.array(z.enum(['chat', 'code', 'math', 'reasoning', 'creative', 'vision', 'long-context'])).max(7).optional(),
  preferredModel: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  enabled: z.boolean().optional(),
  temperature: z.number().min(0).max(1.5).optional(),
});

const shape = (body) => {
  const { temperature, ...rest } = body;
  return { ...rest, ...(temperature != null ? { configuration: { temperature } } : {}) };
};

export const list = asyncHandler(async (req, res) => {
  const agents = await Agent.find(visible(req.user)).sort({ builtIn: -1, name: 1 }).lean();
  res.json({ agents });
});

export const get = asyncHandler(async (req, res) => {
  const agent = await Agent.findOne({ _id: req.params.id, ...visible(req.user) }).lean();
  if (!agent) throw new AppError('Agent not found', 404);
  res.json({ agent });
});

export const create = asyncHandler(async (req, res) => {
  const count = await Agent.countDocuments({ owner: req.user._id });
  if (count >= 20) throw new AppError('You can create up to 20 custom agents', 400);
  const agent = await Agent.create({ ...shape(req.body), key: `custom-${crypto.randomBytes(4).toString('hex')}`, owner: req.user._id, builtIn: false, role: 'worker' });
  res.status(201).json({ agent });
});

export const update = asyncHandler(async (req, res) => {
  const agent = await Agent.findById(req.params.id);
  const own = agent && String(agent.owner) === String(req.user._id);
  if (!agent || (!own && !(agent.builtIn && req.user.role === 'admin'))) throw new AppError('You can only edit your own agents', 403);
  Object.assign(agent, shape(req.body));
  await agent.save();
  res.json({ agent });
});

export const remove = asyncHandler(async (req, res) => {
  const agent = await Agent.findOne({ _id: req.params.id, owner: req.user._id });
  if (!agent) throw new AppError('Custom agent not found', 404);
  await agent.deleteOne();
  res.json({ ok: true });
});
