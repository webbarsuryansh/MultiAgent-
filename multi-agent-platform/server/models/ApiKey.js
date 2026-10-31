import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, required: true },
  encryptedKey: { type: String, required: true, select: false },
  last4: { type: String, required: true },
}, { timestamps: true });

apiKeySchema.index({ userId: 1, provider: 1 }, { unique: true });
export default mongoose.model('ApiKey', apiKeySchema);
