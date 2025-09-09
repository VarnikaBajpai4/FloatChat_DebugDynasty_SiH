const ChatMessage = require("../../models/ChatMessage");
const Conversation = require("../../models/Conversation");

const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  if (!conversationId) {
    return res
      .status(400)
      .json({ success: false, message: "Conversation ID is required" });
  }
  const userId = req.user.id;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return res
      .status(404)
      .json({ success: false, message: "Conversation not found" });
  }
  if (conversation.userId.toString() !== userId) {
    return res
      .status(403)
      .json({ success: false, message: "Unauthorized" });
  }
  try {
    const messages = await ChatMessage.find({ conversationId }).sort({
      timestamp: 1,
    });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
module.exports = getMessages;
