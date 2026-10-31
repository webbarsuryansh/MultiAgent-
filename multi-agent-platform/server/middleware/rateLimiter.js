import rateLimit from 'express-rate-limit';

const make = (windowMs, limit, message) => rateLimit({
  windowMs, limit, standardHeaders: true, legacyHeaders: false,
  message: { error: message },
});

export const apiLimiter = make(60_000, 300, 'Too many requests. Slow down and try again shortly.');
export const authLimiter = make(15 * 60_000, 20, 'Too many sign-in attempts. Try again in 15 minutes.');
export const chatLimiter = make(60_000, 20, 'Too many chat requests. Wait a moment and retry.');
