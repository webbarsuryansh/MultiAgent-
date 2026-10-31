import { Router } from 'express';
import * as c from '../controllers/modelController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const r = Router();
r.use(protect);
r.get('/', c.list);
r.get('/available', c.available);
r.post('/configure', validate(c.configureSchema), c.configure);
r.post('/:id/check', c.check);
export default r;
