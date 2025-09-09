const mongoose = require ('mongoose');

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    default: 'New Chat'
  },
  role: {
    type: String,
    enum: ['Default', 'Student', 'Researcher', 'Policy-Maker'],
    required: true,
    default: 'Default',
  },
  mode: {
    type: String,
    enum: ['Default', 'GeoMap', 'Prediction'],
    required: true,
    default: 'Default',
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
});
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
