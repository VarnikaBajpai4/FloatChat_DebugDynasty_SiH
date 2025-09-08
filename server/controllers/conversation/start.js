const Conversation = require('../../models/Conversation');
const User = require('../../models/User');

const startConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(userId)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const conversation = await Conversation.create({
            userId,
            title: 'New Chat',
        });
        return res.status(201).json({
            success: true,
            conversation: {
                id: conversation._id,
                title: conversation.title,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
                userId: conversation.userId,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

module.exports = startConversation;