const Conversation = require('../../models/Conversation');
const User = require('../../models/User');

const getConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const conversations= await Conversation.find({ userId }).sort({ updatedAt: -1 });
        return res.status(200).json({
            success: true,
            conversations: conversations.map(conversation=>({
                id: conversation._id,
                title: conversation.title,
                role: conversation.role,
                mode: conversation.mode,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
                userId: conversation.userId,
            }))
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

module.exports = getConversation;