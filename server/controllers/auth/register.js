const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const generateTokenAndSetCookie = require("../../config/token");

const register= async(req,res)=>{
    try {
        const {name,email,password}= req.body;
        if(!name || !email || !password){
            return res.status(400).json({success:false, message:"missing required"})
        }
        const normalizedEmail = email.toLowerCase();
        if(await User.findOne({email: normalizedEmail})){
            return res.status(400).json({success:false, message:"User already exists"})
        }
        const hashedPassword= await bcrypt.hash(password, 10);
        const user= await User.create({
            name,
            email: normalizedEmail,
            password: hashedPassword,
        })
        generateTokenAndSetCookie(res,user);
        return res.status(201).json({
            success:true,
            user:{
                id:user._id,
                name:user.name,
                email:user.email
            }
        })
    } catch (error) {
        res.status(500).json({success:false, message:"Server error", error:error.message})
    }
}

module.exports= register;