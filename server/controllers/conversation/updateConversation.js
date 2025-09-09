const Conversation = require('../../models/Conversation');
const User = require('../../models/User');

const ROLE_ENUM = ['Default', 'Student', 'Researcher', 'Policy-Maker'];
const MODE_ENUM = ['Default', 'GeoMap', 'Prediction'];

const updateConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: "Conversation ID is required" });
    }

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

    const { title, role, mode } = req.body || {};

    if (role !== undefined && !ROLE_ENUM.includes(role)) {
      return res.status(400).json({ success: false, message: `Invalid role. Allowed: ${ROLE_ENUM.join(', ')}` });
    }
    if (mode !== undefined && !MODE_ENUM.includes(mode)) {
      return res.status(400).json({ success: false, message: `Invalid mode. Allowed: ${MODE_ENUM.join(', ')}` });
    }

    if (typeof title === 'string' && title.trim().length > 0) {
      conversation.title = title.trim();
    }
    if (role !== undefined) {
      conversation.role = role;
    }
    if (mode !== undefined) {
      conversation.mode = mode;
    }
    conversation.updatedAt = new Date();
    await conversation.save();

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

module.exports = updateConversation;