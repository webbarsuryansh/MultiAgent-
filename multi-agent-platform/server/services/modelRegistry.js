import { PROVIDERS, SEED_MODELS } from '../config/providers.js';
import { env } from '../config/env.js';
import Model from '../models/Model.js';
import Agent from '../models/Agent.js';
import ApiKey from '../models/ApiKey.js';
import { BUILT_IN_AGENTS } from '../agents/agentCatalog.js';
import { decrypt } from '../utils/encryption.js';

export async function seedModels() {
  await Model.bulkWrite(SEED_MODELS.map((m) => ({
    updateOne: { filter: { provider: m.provider, modelId: m.modelId }, update: { $setOnInsert: m }, upsert: true },
  })));
}

export async function seedAgents() {
  await Agent.bulkWrite(BUILT_IN_AGENTS.map((a) => ({
    updateOne: { filter: { key: a.key }, update: { $setOnInsert: { ...a, builtIn: true, enabled: true } }, upsert: true },
  })));
}

/** Map of provider -> { apiKey, source } for providers this user can call right now. */
export async function getCredentials(user) {
  const creds = {};
  const rows = await ApiKey.find({ userId: user._id }).select('+encryptedKey');
  for (const r of rows) {
    try { creds[r.provider] = { apiKey: decrypt(r.encryptedKey), source: 'user' }; } catch { /* key unreadable: ignore */ }
  }
  for (const [name, cfg] of Object.entries(PROVIDERS)) {
    if (creds[name]) continue;
    if (cfg.keyless) { if (env.ollamaEnabled) creds[name] = { apiKey: null, source: 'local' }; continue; }
    if (env.allowServerKeys && cfg.envKey && process.env[cfg.envKey]) creds[name] = { apiKey: process.env[cfg.envKey], source: 'server' };
  }
  return creds;
}

/** All models, annotated with whether this user has them enabled and credentials for them. */
export async function listModelsForUser(user) {
  const [models, creds] = await Promise.all([Model.find().sort({ provider: 1, name: 1 }).lean(), getCredentials(user)]);
  const disabled = new Set((user.preferences?.disabledModels || []).map(String));
  return models.map((m) => {
    const hasCredentials = Boolean(creds[m.provider]);
    const enabledForUser = m.enabled && !disabled.has(String(m._id));
    return {
      ...m,
      providerLabel: PROVIDERS[m.provider]?.label || m.provider,
      enabledForUser,
      hasCredentials,
      credentialSource: creds[m.provider]?.source || null,
      usable: enabledForUser && hasCredentials && Boolean(PROVIDERS[m.provider]),
    };
  });
}

export async function getUsableModels(user) {
  return (await listModelsForUser(user)).filter((m) => m.usable);
}
