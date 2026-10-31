import mongoose from 'mongoose';

const preferencesSchema = new mongoose.Schema({
  maxTokens: { type: Number, default: 1500, min: 100, max: 8000 },
  timeoutMs: { type: Number, default: 60000, min: 5000, max: 180000 },
  maxAgents: { type: Number, default: 4, min: 1, max: 6 },
  collaborationRounds: { type: Number, default: 2, min: 1, max: 5 },
  selectionStrategy: { type: String, enum: ['balanced', 'quality', 'speed', 'cost'], default: 'balanced' },
  maxCostPer1M: { type: Number, default: null, min: 0 }, // avg $/1M tokens ceiling; null = no limit
  enableCritic: { type: Boolean, default: true },
  enableSynthesizer: { type: Boolean, default: true },
  disabledModels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Model' }],
  agentModels: { type: Map, of: String, default: {} }, // agentKey -> Model _id
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 3, maxlength: 30, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  subscriptionPlan: { type: String, enum: ['free', 'pro', 'team'], default: 'free' },
  preferences: { type: preferencesSchema, default: () => ({}) },
}, { timestamps: { createdAt: true, updatedAt: false } });

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id, username: this.username, email: this.email, role: this.role, subscriptionPlan: this.subscriptionPlan, preferences: this.preferences, createdAt: this.createdAt };
};

export default mongoose.model('User', userSchema);
