import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Agent from '../models/Agent.js';
import Upload from '../models/Upload.js';
import { env } from '../config/env.js';
import { PROVIDERS } from '../config/providers.js';
import { AppError } from '../utils/AppError.js';
import { getUsableModels, getCredentials } from './modelRegistry.js';
import { rankModels } from './modelSelector.js';
import { buildAgentMessages, runSlot } from './aiOrchestrator.js';
import { evaluateResponses, synthesize } from './responseEvaluator.js';
import { routeAgents } from '../agents/agentRouter.js';

const providerLabel = (p) => PROVIDERS[p]?.label || p;
const clip = (s = '', n) => (s.length > n ? `${s.slice(0, n)}…` : s);

async function buildHistory(conversationId, before) {
  const rows = await Message.find({ conversationId, ...(before ? { createdAt: { $lt: before } } : {}) }).sort({ createdAt: -1 }).limit(6).lean();
  return rows.reverse().flatMap((m) => {
    const answer = m.finalResponse?.content || m.agentResponses?.find((r) => r.status === 'completed')?.content;
    return answer ? [{ role: 'user', content: clip(m.prompt, 1500) }, { role: 'assistant', content: clip(answer, 2000) }] : [];
  });
}

const visibleAgents = (userId) => Agent.find({ enabled: true, role: 'worker', $or: [{ owner: null }, { owner: userId }] }).lean();

/**
 * Full chat turn: route -> run agents (parallel, or collaborative rounds, or model arena)
 * -> critic -> synthesizer. Streams progress through emit(event, data) and persists the result
 * (even when cancelled). Used by both the Socket.IO handler and POST /api/chat.
 */
export async function handleChat({ user, payload, emit = () => {}, signal }) {
  const prefs = user.preferences.toObject ? user.preferences.toObject() : user.preferences;
  const prompt = payload.prompt.trim();
  const mode = payload.mode || 'parallel';

  const [usable, creds] = await Promise.all([getUsableModels(user), getCredentials(user)]);
  if (!usable.length) throw new AppError('No models are available yet. Add an API key under API Settings, or enable a model on the Models page.', 400);

  let convo;
  if (payload.conversationId) {
    convo = await Conversation.findOne({ _id: payload.conversationId, userId: user._id });
    if (!convo) throw new AppError('Conversation not found', 404);
  } else {
    convo = await Conversation.create({ userId: user._id, title: clip(prompt.replace(/\s+/g, ' '), 60) });
  }

  const uploads = payload.attachmentIds?.length ? await Upload.find({ _id: { $in: payload.attachmentIds }, userId: user._id }) : [];
  const documents = uploads.filter((u) => u.text).map((u) => ({ name: u.name, text: u.text }));
  const images = uploads.filter((u) => u.imageBase64).map((u) => ({ mime: u.mime, data: u.imageBase64 }));
  const needsVision = images.length > 0;

  const agents = await visibleAgents(user._id);
  const [criticAgent, synthAgent] = await Promise.all([Agent.findOne({ key: 'critic' }).lean(), Agent.findOne({ key: 'synthesizer' }).lean()]);
  const history = await buildHistory(convo._id);

  /* ----- routing ----- */
  const byKey = Object.fromEntries(agents.map((a) => [a.key, a]));
  let routing;
  if (payload.agentKeys?.length) {
    const keys = [...new Set(payload.agentKeys)].filter((k) => byKey[k]).slice(0, env.maxAgentsHardLimit);
    if (!keys.length) throw new AppError('None of the selected agents are available', 400);
    routing = { agents: keys, method: 'manual', complexity: '', domain: '', intent: '', reasoning: 'Agents chosen by you.' };
  } else {
    routing = await routeAgents({ prompt, agents, user, models: usable, creds, signal });
  }

  /* ----- slots: agent + ranked model candidates ----- */
  const usage = {};
  const slots = [];
  if (mode === 'arena') {
    const agent = byKey[routing.agents[0]] || byKey.general;
    const ranked = rankModels({ agent, models: usable, user, needsVision, strategy: 'quality' });
    if (!ranked.length) throw new AppError('No enabled vision-capable model for this attachment', 400);
    const count = Math.min(Math.max(prefs.maxAgents, 2), 4, ranked.length);
    // spread across providers first so one outage does not blank the arena
    const picked = [];
    for (const m of ranked) if (picked.length < count && !picked.some((p) => p.provider === m.provider)) picked.push(m);
    for (const m of ranked) if (picked.length < count && !picked.includes(m)) picked.push(m);
    routing = { ...routing, agents: [agent.key], reasoning: `Model arena: "${agent.name}" answered with ${picked.length} different models.` };
    for (const m of picked) slots.push({ key: `${agent.key}@${m._id}`, agent, candidates: [m] });
  } else {
    for (const key of routing.agents) {
      const agent = byKey[key];
      const ranked = rankModels({ agent, models: usable, user, usage, needsVision });
      if (!ranked.length) throw new AppError('No enabled vision-capable model for this attachment', 400);
      usage[String(ranked[0]._id)] = (usage[String(ranked[0]._id)] || 0) + 1;
      slots.push({ key, agent, candidates: ranked.slice(0, 3) });
    }
  }

  /* ----- persist skeleton + announce ----- */
  const results = Object.fromEntries(slots.map((s) => [s.key, {
    key: s.key, agentKey: s.agent.key, agentName: s.agent.name, icon: s.agent.icon,
    provider: s.candidates[0].provider, model: s.candidates[0].modelId, modelName: s.candidates[0].name, modelDocId: String(s.candidates[0]._id),
    status: 'queued', content: '', round: 1,
  }]));
  const message = await Message.create({
    conversationId: convo._id, userId: user._id, prompt, mode, routing,
    attachments: uploads.map((u) => ({ name: u.name, mime: u.mime })),
    agentResponses: Object.values(results), status: 'running',
  });
  convo.messages.push(message._id);
  convo.selectedAgents = routing.agents;
  await convo.save();

  const messageId = String(message._id);
  const send = (event, data = {}) => emit(event, { messageId, ...data });
  send('chat:start', {
    conversationId: String(convo._id), title: convo.title, prompt, mode, routing,
    attachments: uploads.map((u) => ({ name: u.name, mime: u.mime })),
    agents: slots.map((s) => ({ key: s.key, agentKey: s.agent.key, agentName: s.agent.name, icon: s.agent.icon, status: 'queued', modelName: s.candidates[0].name, provider: s.candidates[0].provider, providerLabel: providerLabel(s.candidates[0].provider) })),
  });

  const finish = async (status) => {
    message.agentResponses = slots.map((s) => results[s.key]);
    message.markModified('agentResponses');
    message.status = status;
    await message.save();
  };

  try {
    /* ----- agent rounds ----- */
    const totalRounds = mode === 'collab' ? Math.min(prefs.collaborationRounds, env.maxCollabRounds) : 1;
    for (let round = 1; round <= totalRounds; round += 1) {
      if (signal?.aborted) break;
      send('round:start', { round, total: totalRounds });
      const snapshot = Object.fromEntries(slots.map((s) => [s.key, { content: results[s.key].content, status: results[s.key].status }]));
      const active = slots.filter((s) => round === 1 || snapshot[s.key].status === 'completed');
      if (round > 1) active.forEach((s) => send('agent:reset', { key: s.key }));

      let changed = round === 1;
      await Promise.all(active.map(async (slot) => {
        const peers = round > 1
          ? slots.filter((s) => s.key !== slot.key && snapshot[s.key].status === 'completed').map((s) => ({ name: results[s.key].agentName, content: snapshot[s.key].content }))
          : [];
        const messages = buildAgentMessages({ agent: slot.agent, prompt, history, documents, images, peers, ownDraft: snapshot[slot.key].content, round });
        const res = await runSlot({ slot, creds, messages, round, emit: send, signal, prefs });

        if (round > 1 && (res.status !== 'completed' || res.content.trim() === 'NO_CHANGES')) {
          // keep the previous draft; a failed refinement must not wipe a good answer
          send('agent:done', { key: slot.key, ...results[slot.key] });
          return;
        }
        if (round > 1) changed = true;
        results[slot.key] = { ...results[slot.key], ...res, feedback: null };
        send(res.status === 'completed' ? 'agent:done' : 'agent:error', { ...results[slot.key] });
      }));
      if (round > 1 && !changed) { send('round:early-stop', { round }); break; }
    }

    if (signal?.aborted) {
      slots.forEach((s) => { if (['queued', 'running'].includes(results[s.key].status)) results[s.key].status = 'cancelled'; });
      await finish('cancelled');
      send('chat:done', { status: 'cancelled' });
      return message.toObject();
    }

    const done = slots.map((s) => results[s.key]).filter((r) => r.status === 'completed');
    if (!done.length) {
      const reason = results[slots[0].key]?.error || 'Every agent failed';
      message.finalResponse = { status: 'failed', error: reason };
      await finish('error');
      send('chat:error', { error: `All agents failed. ${reason}` });
      return message.toObject();
    }

    /* ----- critic ----- */
    let evaluations = {};
    let summary = '';
    const roster = done.map((r) => ({ key: r.key, name: r.agentName, content: r.content }));
    if (done.length >= 2 && prefs.enableCritic && criticAgent) {
      send('eval:start');
      try {
        const candidates = rankModels({ agent: criticAgent, models: usable, user, usage, strategy: 'quality' });
        const ev = await evaluateResponses({ prompt, responses: roster, criticAgent, candidates, creds, prefs, signal });
        evaluations = ev.evaluations;
        summary = ev.summary;
        for (const [k, v] of Object.entries(evaluations)) results[k].evaluation = v;
        message.evaluationSummary = summary;
        send('eval:done', { evaluations, summary, judge: ev.model.name });
      } catch (err) {
        if (err.cancelled) throw err;
        send('eval:error', { error: err.message });
      }
    }

    /* ----- synthesizer ----- */
    if (done.length >= 2 && prefs.enableSynthesizer && synthAgent && !signal?.aborted) {
      try {
        const candidates = rankModels({ agent: synthAgent, models: usable, user, usage, strategy: 'quality' });
        const r = await synthesize({
          prompt, responses: roster, evaluations, summary, synthAgent, candidates, creds, prefs, signal,
          onToken: (token) => send('synth:token', { token }),
          onAttempt: (m, i) => { if (i > 0) send('synth:reset'); send('synth:start', { model: m.name, provider: m.provider, providerLabel: providerLabel(m.provider) }); },
        });
        message.finalResponse = { content: r.text, provider: r.model.provider, model: r.model.name, status: 'completed', tokens: { input: r.usage.input, output: r.usage.output }, cost: r.cost };
        send('synth:done', { content: r.text, provider: r.model.provider, model: r.model.name, tokens: r.usage, cost: r.cost });
      } catch (err) {
        if (err.cancelled) throw err;
        message.finalResponse = { status: 'failed', error: err.message };
        send('synth:error', { error: err.message });
      }
    }

    await finish(signal?.aborted ? 'cancelled' : 'done');
    const totals = slots.reduce((t, s) => ({ tokens: t.tokens + (results[s.key].tokens?.input || 0) + (results[s.key].tokens?.output || 0), cost: t.cost + (results[s.key].cost || 0) }), { tokens: 0, cost: 0 });
    send('chat:done', { status: message.status, usage: totals });
    return message.toObject();
  } catch (err) {
    if (err.cancelled || signal?.aborted) {
      slots.forEach((s) => { if (['queued', 'running'].includes(results[s.key].status)) results[s.key].status = 'cancelled'; });
      await finish('cancelled');
      send('chat:done', { status: 'cancelled' });
      return message.toObject();
    }
    await finish('error');
    throw err;
  }
}

/** Re-run a single agent card of an existing message. */
export async function regenerateSlot({ user, messageId, key, emit = () => {}, signal }) {
  const message = await Message.findOne({ _id: messageId, userId: user._id });
  if (!message) throw new AppError('Message not found', 404);
  const idx = message.agentResponses.findIndex((r) => r.key === key);
  if (idx === -1) throw new AppError('Agent response not found', 404);
  const prev = message.agentResponses[idx].toObject();

  const [usable, creds, agents] = await Promise.all([getUsableModels(user), getCredentials(user), visibleAgents(user._id)]);
  const agent = agents.find((a) => a.key === prev.agentKey);
  if (!agent) throw new AppError('That agent is no longer available', 404);
  const prefs = user.preferences.toObject ? user.preferences.toObject() : user.preferences;

  let candidates;
  if (message.mode === 'arena') {
    const m = usable.find((x) => String(x._id) === prev.modelDocId);
    if (!m) throw new AppError('That model is no longer available', 400);
    candidates = [m];
  } else {
    candidates = rankModels({ agent, models: usable, user }).slice(0, 3);
  }
  if (!candidates.length) throw new AppError('No usable model for this agent', 400);

  const send = (event, data = {}) => emit(event, { messageId: String(message._id), ...data });
  const history = await buildHistory(message.conversationId, message.createdAt);
  const slot = { key, agent, candidates };
  send('agent:reset', { key });
  const res = await runSlot({ slot, creds, messages: buildAgentMessages({ agent, prompt: message.prompt, history }), emit: send, signal, prefs });

  if (res.status !== 'completed') {
    send('agent:error', { key, ...prev, ...res, content: prev.content });
    return;
  }
  message.agentResponses[idx] = { ...prev, ...res, feedback: null, evaluation: undefined };
  message.markModified('agentResponses');
  await message.save();
  send('agent:done', { ...message.agentResponses[idx].toObject(), regenerated: true });
  send('chat:done', { status: message.status });
}
