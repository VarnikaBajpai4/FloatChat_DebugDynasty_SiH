const Conversation = require('../../models/Conversation');
const User = require('../../models/User');

const getConversationById = async (req, res) => {
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

    return res.status(200).json({
      success: true,
      conversation: {
        id: conversation._id,
        title: conversation.title,
        role: conversation.role,
        mode: conversation.mode,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        userId: conversation.userId,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

module.exports = getConversationById;