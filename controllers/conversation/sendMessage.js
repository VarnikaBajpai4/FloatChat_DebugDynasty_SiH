//this will be the main point of this system. expect a very large file here
const Conversation = require("../../models/Conversation");
const ChatMessage = require("../../models/ChatMessage");
const User = require("../../models/User");
const sendMessageStream = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { message } = req.body;

    if (!message || !conversationId) {
      return res.status(400).json({
        success: false,
        message: "Message and conversationId are required",
      });
    }

    const user = await User.findById(userId);
    const conversation = await Conversation.findById(conversationId);

    if (!user || !conversation) {
      return res
        .status(404)
        .json({ success: false, message: "User or conversation not found" });
    }

    if (conversation.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const userMessage = await ChatMessage.create({
      conversationId,
      userId,
      role: "user",
      content: message,
      metadata: {},
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    res.write(`event: ack\n`);
    res.write(`data: ${JSON.stringify({ status: "processing" })}\n\n`);

    // neeche mocked response hai
    const fullMessage = `Echoing: ${message} [done]`;
    const tokens = fullMessage.split(" "); // Split into words

    for (const token of tokens) {
      res.write(`event: token\n`);
      res.write(`data: ${JSON.stringify({ content: token })}\n\n`);

      await new Promise((r) => setTimeout(r, 100)); // simulate delay
    }

    // Save assistant response
    const aiMessage = await ChatMessage.create({
      conversationId,
      userId,
      role: "assistant",
      content: fullMessage.replace(" [done]", ""),
      metadata: {},
    });

    conversation.updatedAt = new Date();
    await conversation.save();

    // Send final event
    res.write(`event: done\n`);
    res.write(`data: ${JSON.stringify({ messageId: aiMessage._id })}\n\n`);
    res.end();
  } catch (err) {
    console.error(err);
    res.end(
      `event: error\ndata: ${JSON.stringify({
        error: "Internal Server Error",
      })}\n\n`
    );
  }
};
module.exports = sendMessageStream;
