const express = require('express');
const connectDB = require('./config/db');
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();



// Core middleware
app.use(express.json());
app.use(cookieParser());

// CORS for client (allow credentials)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

// DB
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth.router'));
app.use('/api/chat', require('./routes/conversation.router'));

// Server
const PORT = process.env.PORT || 5555;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});