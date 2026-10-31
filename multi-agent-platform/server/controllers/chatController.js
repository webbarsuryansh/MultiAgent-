import { z } from 'zod';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { handleChat } from '../services/chatService.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

export const chatSchema = z.object({
  prompt: z.string().trim().min(1, 'Type a prompt first').max(20000),
  conversationId: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  agentKeys: z.array(z.string().max(60)).max(8).optional(),
  mode: z.enum(['parallel', 'collab', 'arena']).optional(),
  attachmentIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(4).optional(),
});

export const postChat = asyncHandler(async (req, res) => {
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });
  const message = await handleChat({ user: req.user, payload: req.body, signal: ac.signal });
  res.json({ message, conversationId: message.conversationId });
});

export const history = asyncHandler(async (req, res) => {
  const q = { userId: req.user._id };
  if (req.query.saved === 'true') q.saved = true;
  if (req.query.search) q.title = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const rows = await Conversation.find(q).sort({ updatedAt: -1 }).limit(200).select('title saved updatedAt createdAt selectedAgents').lean();
  res.json({ conversations: rows });
});

const owned = async (req) => {
  const convo = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!convo) throw new AppError('Conversation not found', 404);
  return convo;
};

export const getConversation = asyncHandler(async (req, res) => {
  const convo = await owned(req);
  const messages = await Message.find({ conversationId: convo._id }).sort({ createdAt: 1 }).lean();
  res.json({ conversation: convo, messages });
});

export const patchSchema = z.object({ title: z.string().trim().min(1).max(120).optional(), saved: z.boolean().optional() });
export const patchConversation = asyncHandler(async (req, res) => {
  const convo = await owned(req);
  Object.assign(convo, req.body);
  await convo.save();
  res.json({ conversation: convo });
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const convo = await owned(req);
  await Message.deleteMany({ conversationId: convo._id, userId: req.user._id });
  await convo.deleteOne();
  res.json({ ok: true });
});

export const feedbackSchema = z.object({ key: z.string().max(100), value: z.enum(['like', 'dislike']).nullable() });
export const feedback = asyncHandler(async (req, res) => {
  const msg = await Message.findOne({ _id: req.params.messageId, userId: req.user._id });
  if (!msg) throw new AppError('Message not found', 404);
  const r = msg.agentResponses.find((x) => x.key === req.body.key);
  if (!r) throw new AppError('Agent response not found', 404);
  r.feedback = req.body.value;
  await msg.save();
  res.json({ ok: true });
});

export const voteSchema = z.object({ kind: z.enum(['best', 'detailed', 'creative', 'accurate']), key: z.string().max(100).nullable() });
export const vote = asyncHandler(async (req, res) => {
  const msg = await Message.findOne({ _id: req.params.messageId, userId: req.user._id });
  if (!msg) throw new AppError('Message not found', 404);
  if (req.body.key && !msg.agentResponses.some((x) => x.key === req.body.key)) throw new AppError('Agent response not found', 404);
  msg.votes = { ...(msg.votes?.toObject?.() || {}), [req.body.kind]: req.body.key || undefined };
  await msg.save();
  res.json({ votes: msg.votes });
});

export const exportConversation = asyncHandler(async (req, res) => {
  const convo = await owned(req);
  const messages = await Message.find({ conversationId: convo._id }).sort({ createdAt: 1 }).lean();
  const safe = convo.title.replace(/[^\w.-]+/g, '_').slice(0, 50) || 'conversation';
  if (req.query.format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="${safe}.json"`);
    return res.json({ conversation: convo, messages });
  }
  const md = [`# ${convo.title}`, ''];
  for (const m of messages) {
    md.push(`## You`, '', m.prompt, '');
    if (m.finalResponse?.content) md.push(`## Final answer (${m.finalResponse.model || 'synthesizer'})`, '', m.finalResponse.content, '');
    for (const r of m.agentResponses) {
      if (r.status !== 'completed') continue;
      md.push(`### ${r.agentName} — ${r.modelName || r.model}${r.evaluation ? ` (critic score ${r.evaluation.overall}/100)` : ''}`, '', r.content, '');
    }
  }
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}.md"`);
  res.send(md.join('\n'));
});
