import { z } from 'zod';
import ApiKey from '../models/ApiKey.js';
import { PROVIDERS } from '../config/providers.js';
import { env } from '../config/env.js';
import { encrypt } from '../utils/encryption.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

export const keySchema = z.object({
  provider: z.string().refine((p) => PROVIDERS[p] && !PROVIDERS[p].keyless, 'Unsupported provider'),
  key: z.string().trim().min(8).max(500),
});

// Key values are never returned. Only provider + last 4 characters, so users can tell keys apart.
export const list = asyncHandler(async (req, res) => {
  const keys = await ApiKey.find({ userId: req.user._id }).select('provider last4 updatedAt').lean();
  res.json({ keys });
});

export const providers = asyncHandler(async (_req, res) => {
  res.json({
    providers: Object.entries(PROVIDERS).map(([id, p]) => ({
      id, label: p.label, docs: p.docs, keyless: Boolean(p.keyless),
      serverKey: Boolean(env.allowServerKeys && p.envKey && process.env[p.envKey]),
      localEnabled: p.keyless ? env.ollamaEnabled : undefined,
    })),
  });
});

export const save = asyncHandler(async (req, res) => {
  const { provider, key } = req.body;
  const doc = await ApiKey.findOneAndUpdate(
    { userId: req.user._id, provider },
    { encryptedKey: encrypt(key), last4: key.slice(-4) },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.status(201).json({ key: { _id: doc._id, provider, last4: doc.last4, updatedAt: doc.updatedAt } });
});

export const remove = asyncHandler(async (req, res) => {
  const doc = await ApiKey.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw new AppError('Key not found', 404);
  res.json({ ok: true });
});
