import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { signToken } from '../middleware/authMiddleware.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/, 'Use letters, numbers, dots, dashes or underscores'),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

export const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, email, passwordHash, role: env.adminEmail && email === env.adminEmail ? 'admin' : 'user' });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) throw new AppError('Incorrect email or password', 401);
  res.json({ token: signToken(user), user: user.toPublic() });
});

export const me = (req, res) => res.json({ user: req.user.toPublic() });
