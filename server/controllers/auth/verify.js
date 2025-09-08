const User = require('../../models/User');
const verifyUser= async(req,res)=>{
    const userID = req.user.id;
    const user = await User.findById(userID);
    if(!user){
        return res.status(404).json({ success: false, message: "User not found"});
    }
    return res.status(200).json({success:true});
}
module.exports= verifyUser;