const express = require('express');
const authenticateJWT = require('../middleware/jwt');
const getConversations = require('../controllers/conversation/getConversations');
const getMessages = require('../controllers/conversation/getMessages');
const sendMessage = require('../controllers/conversation/sendMessage');
const startConversation = require('../controllers/conversation/start');

const router = express.Router();

router.post('/start', authenticateJWT, startConversation);
router.get('/', authenticateJWT, getConversations);
router.get('/:conversationId/messages', authenticateJWT, getMessages);
router.post('/:conversationId/message', authenticateJWT, sendMessage);

module.exports = router;