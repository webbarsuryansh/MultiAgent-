import { Router } from 'express';
import * as c from '../controllers/keyController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const r = Router();
r.use(protect);
r.get('/', c.list);
r.get('/providers', c.providers);
r.post('/', validate(c.keySchema), c.save);
r.delete('/:id', c.remove);
export default r;
