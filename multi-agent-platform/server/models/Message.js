import mongoose from 'mongoose';

const evaluationSchema = new mongoose.Schema({
  scores: { type: Map, of: Number }, // accuracy, relevance, completeness, clarity, reasoning, instruction
  overall: Number,
  explanation: String,
  issues: [String],
}, { _id: false });

const agentResponseSchema = new mongoose.Schema({
  key: String, // slot key: agent key, or "agent@modelDocId" in arena mode
  agentKey: String,
  agentName: String,
  icon: String,
  provider: String,
  model: String,
  modelName: String,
  modelDocId: String,
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed', 'cancelled'], default: 'queued' },
  content: { type: String, default: '' },
  error: String,
  latencyMs: Number,
  round: { type: Number, default: 1 },
  tokens: { input: { type: Number, default: 0 }, output: { type: Number, default: 0 }, estimated: Boolean },
  cost: { type: Number, default: 0 },
  feedback: { type: String, enum: ['like', 'dislike', null], default: null },
  evaluation: evaluationSchema,
}, { _id: false });

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, default: 'turn' },
  prompt: { type: String, required: true },
  attachments: [{ name: String, mime: String }],
  mode: { type: String, enum: ['parallel', 'collab', 'arena'], default: 'parallel' },
  routing: { agents: [String], intent: String, complexity: String, domain: String, reasoning: String, method: String },
  agentResponses: [agentResponseSchema],
  evaluationSummary: String,
  finalResponse: {
    content: String, provider: String, model: String, status: String, error: String,
    tokens: { input: Number, output: Number }, cost: Number,
  },
  votes: { best: String, detailed: String, creative: String, accurate: String },
  status: { type: String, enum: ['running', 'done', 'error', 'cancelled'], default: 'running' },
}, { timestamps: { createdAt: true, updatedAt: false } });

messageSchema.index({ userId: 1, createdAt: -1 });
export default mongoose.model('Message', messageSchema);
