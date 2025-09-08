const jwt= require('jsonwebtoken');
 const generateTokenAndSetCookie = (res, user) => {
  const token = jwt.sign({id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("token", token, {
    httpOnly: true, 
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};
module.exports = generateTokenAndSetCookie;