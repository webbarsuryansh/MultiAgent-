import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

export const signToken = (user) => jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '7d' });

export async function userFromToken(token) {
  if (!token) throw new AppError('Authentication required', 401);
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { throw new AppError('Invalid or expired token', 401); }
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError('Account no longer exists', 401);
  return user;
}

export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  req.user = await userFromToken(header.startsWith('Bearer ') ? header.slice(7) : null);
  next();
});

export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError('You do not have permission to do that', 403));
