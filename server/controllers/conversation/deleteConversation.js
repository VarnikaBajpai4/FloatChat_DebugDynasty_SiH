const Conversation = require('../../models/Conversation');
const ChatMessage = require('../../models/ChatMessage');
const User = require('../../models/User');

const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!conversationId) {
      return res.status(400).json({ success: false, message: "Conversation ID is required" });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }

    if (conversation.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    await ChatMessage.deleteMany({ conversationId });
    await Conversation.deleteOne({ _id: conversationId });

    return res.status(200).json({ success: true, message: "Conversation deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = deleteConversation;