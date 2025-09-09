const jwt = require('jsonwebtoken');

const generateTokenAndSetCookie = (res, user) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  const isProd = process.env.NODE_ENV === 'production';

  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd, // requires HTTPS when true
    // path: '/', // default
    // domain: set only if deploying across subdomains
  });

  return token;
};

module.exports = generateTokenAndSetCookie;