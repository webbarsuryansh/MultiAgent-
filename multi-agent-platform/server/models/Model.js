import mongoose from 'mongoose';

const modelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  provider: { type: String, required: true, index: true },
  modelId: { type: String, required: true },
  capabilities: [String],
  contextWindow: { type: Number, default: 8000 },
  enabled: { type: Boolean, default: true },
  qualityTier: { type: Number, min: 1, max: 3, default: 2 },
  speedTier: { type: Number, min: 1, max: 3, default: 2 },
  pricingInformation: { inputPer1M: { type: Number, default: 0 }, outputPer1M: { type: Number, default: 0 } },
  availabilityStatus: { type: String, enum: ['unknown', 'available', 'unavailable'], default: 'unknown' },
}, { timestamps: true });

modelSchema.index({ provider: 1, modelId: 1 }, { unique: true });
export default mongoose.model('Model', modelSchema);
