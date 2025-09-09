const Conversation = require('../../models/Conversation');
const User = require('../../models/User');

const ROLE_ENUM = ['Default', 'Student', 'Researcher', 'Policy-Maker'];
const MODE_ENUM = ['Default', 'GeoMap', 'Prediction'];

const startConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, role, mode } = req.body || {};

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (role && !ROLE_ENUM.includes(role)) {
            return res.status(400).json({ success: false, message: `Invalid role. Allowed: ${ROLE_ENUM.join(', ')}` });
        }
        if (mode && !MODE_ENUM.includes(mode)) {
            return res.status(400).json({ success: false, message: `Invalid mode. Allowed: ${MODE_ENUM.join(', ')}` });
        }

        // Naming scheme: Chat 1, Chat 2, ... per user when no explicit title is provided
        const defaultTitle = (title && title.trim())
          ? title.trim()
          : `Chat ${(await Conversation.countDocuments({ userId })) + 1}`;

        const conversation = await Conversation.create({
            userId,
            title: defaultTitle,
            role: role || 'Default',
            mode: mode || 'Default',
        });

        return res.status(201).json({
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

module.exports = startConversation;