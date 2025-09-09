const logout = async (req, res) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';

    // Clear the auth cookie set during login
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      // path: '/', // default
      // domain: set if you explicitly set domain during cookie creation
    });

    return res.status(200).json({ success: true, message: 'Logged out' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = logout;