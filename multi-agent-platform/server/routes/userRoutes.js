import { Router } from 'express';
import * as c from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const r = Router();
r.use(protect);
r.put('/preferences', validate(c.prefsSchema), c.updatePreferences);
r.get('/usage', c.usage);
export default r;
