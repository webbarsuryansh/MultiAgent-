import { Router } from 'express';
import * as c from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { chatLimiter } from '../middleware/rateLimiter.js';

const r = Router();
r.use(protect);
r.post('/', chatLimiter, validate(c.chatSchema), c.postChat);
r.get('/history', c.history);
r.post('/message/:messageId/feedback', validate(c.feedbackSchema), c.feedback);
r.post('/message/:messageId/vote', validate(c.voteSchema), c.vote);
r.get('/:id', c.getConversation);
r.get('/:id/export', c.exportConversation);
r.patch('/:id', validate(c.patchSchema), c.patchConversation);
r.delete('/:id', c.deleteConversation);
export default r;
