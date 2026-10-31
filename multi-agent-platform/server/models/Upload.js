import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: String,
  mime: String,
  text: String,       // extracted text (pdf, docx, txt)
  imageBase64: String, // images only
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 }, // auto-delete after 24h
});

export default mongoose.model('Upload', uploadSchema);
