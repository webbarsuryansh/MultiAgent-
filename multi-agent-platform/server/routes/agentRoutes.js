import { Router } from 'express';
import * as c from '../controllers/agentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const r = Router();
r.use(protect);
r.get('/', c.list);
r.get('/:id', c.get);
r.post('/', validate(c.agentSchema), c.create);
r.put('/:id', validate(c.agentSchema.partial()), c.update);
r.delete('/:id', c.remove);
export default r;
