const express= require('express')
const register= require('../controllers/auth/register')
const login= require('../controllers/auth/login')
const verifyUser  = require('../controllers/auth/verify')
const logout = require('../controllers/auth/logout')
const authenticateJWT  = require('../middleware/jwt')

const router = express.Router()

router.post('/register',register)
router.post('/login',login)
router.get('/verify', authenticateJWT, verifyUser)
// logout simply clears the cookie; auth not strictly required
router.post('/logout', logout)

module.exports= router