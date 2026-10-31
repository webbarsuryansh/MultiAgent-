import { Router } from 'express';
import { uploadFile } from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/upload.js';

const r = Router();
r.post('/', protect, upload.single('file'), uploadFile);
export default r;
