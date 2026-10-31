import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import Upload from '../models/Upload.js';
import { AppError, asyncHandler } from '../utils/AppError.js';

const MAX_CHARS = 30000;

export const uploadFile = asyncHandler(async (req, res) => {
  const f = req.file;
  if (!f) throw new AppError('Choose a file to upload', 400);
  const doc = { userId: req.user._id, name: f.originalname.slice(0, 120), mime: f.mimetype };
  try {
    if (f.mimetype.startsWith('image/')) {
      if (f.size > 5 * 1024 * 1024) throw new AppError('Images must be under 5 MB', 400);
      doc.imageBase64 = f.buffer.toString('base64');
    } else if (f.mimetype === 'application/pdf') {
      doc.text = (await pdfParse(f.buffer)).text;
    } else if (f.mimetype.includes('wordprocessingml')) {
      doc.text = (await mammoth.extractRawText({ buffer: f.buffer })).value;
    } else {
      doc.text = f.buffer.toString('utf8');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Could not read that file. It may be encrypted or corrupted.', 422);
  }
  if (doc.text !== undefined) {
    doc.text = doc.text.replace(/\u0000/g, '').trim();
    if (!doc.text) throw new AppError('No readable text found in that file (scanned PDFs need OCR first).', 422);
  }
  const saved = await Upload.create({ ...doc, text: doc.text?.slice(0, MAX_CHARS) });
  res.status(201).json({ upload: { id: saved._id, name: saved.name, mime: saved.mime, kind: doc.imageBase64 ? 'image' : 'document', chars: saved.text?.length || 0, truncated: (doc.text?.length || 0) > MAX_CHARS } });
});
