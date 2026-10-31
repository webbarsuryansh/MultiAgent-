import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, default: 'New chat', maxlength: 120 },
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  selectedAgents: [String],
  saved: { type: Boolean, default: false },
}, { timestamps: true });

conversationSchema.index({ userId: 1, updatedAt: -1 });
export default mongoose.model('Conversation', conversationSchema);
