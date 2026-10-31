import { Router } from 'express';
import * as c from '../controllers/responseController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { chatLimiter } from '../middleware/rateLimiter.js';

const r = Router();
r.use(protect, chatLimiter);
r.post('/evaluate', validate(c.bodySchema), c.evaluate);
r.post('/synthesize', validate(c.bodySchema), c.synth);
export default r;
