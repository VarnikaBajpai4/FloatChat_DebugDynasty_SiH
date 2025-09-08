const jwt= require('jsonwebtoken');

const authenticateJWT= (req,res,next)=>{
    const token= req.cookies.token;
    if(!token){
        return res.status(401).json({ success: false, message: "No token provided"});
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user)=>{
        if(err){
            return res.status(403).json({success: false, message: "Invalid token"});
        }
        console.log(user)
        req.user= user;
        next();
    });

}
module.exports= authenticateJWT;