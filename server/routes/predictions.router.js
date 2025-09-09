const express = require('express');
const runPrediction = require('../controllers/predictions/run');

const router = express.Router();

// Public for now (no auth) so it can be exercised via Postman easily.
// If you want to protect it, add: const authenticateJWT = require('../middleware/jwt');
// and then: router.post('/', authenticateJWT, runPrediction);
router.post('/', runPrediction);

module.exports = router;