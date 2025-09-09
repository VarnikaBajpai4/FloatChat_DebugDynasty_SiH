const User = require('../../models/User');

const verifyUser = async (req, res) => {
  try {
    const userID = req.user.id;
    const user = await User.findById(userID);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

module.exports = verifyUser;