import mongoose from 'mongoose';

const agentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, default: '', maxlength: 300 },
  icon: { type: String, default: 'Bot' },
  role: { type: String, enum: ['worker', 'system'], default: 'worker' }, // critic + synthesizer are "system"
  systemPrompt: { type: String, required: true, maxlength: 4000 },
  supportedTasks: [String],
  requiredCapabilities: [String],
  preferredModel: { type: mongoose.Schema.Types.ObjectId, ref: 'Model', default: null },
  enabled: { type: Boolean, default: true },
  builtIn: { type: Boolean, default: false },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  configuration: { temperature: { type: Number, default: 0.7 } },
}, { timestamps: true });

export default mongoose.model('Agent', agentSchema);
