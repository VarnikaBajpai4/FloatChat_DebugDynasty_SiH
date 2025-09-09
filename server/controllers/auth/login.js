const User = require("../../models/User");
const generateTokenAndSetCookie = require("../../config/token");
const bcrypt = require("bcryptjs");
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false,message: "Email and password are required" });
    }

    // Normalize email to lowercase for case-insensitive authentication
    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ success: false,message: "Invalid email" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({success: false, message: "Invalid password" });
    }
    generateTokenAndSetCookie(res, user);
    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({success: false, message: "Server error", error: error.message });
  }
};
module.exports = login;