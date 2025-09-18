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
app.use('/api/predictions', require('./routes/predictions.router'));

// Server
const PORT = process.env.PORT || 5555;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Bump HTTP server timeouts to support long-running requests/streams
// headersTimeout: time allowed to receive all headers after socket connection
server.headersTimeout = Number(process.env.HEADERS_TIMEOUT_MS || 300000); // 5 minutes

// requestTimeout: how long to wait for the entire request (0 = no timeout)
server.requestTimeout = Number(process.env.REQUEST_TIMEOUT_MS || 0);

// keepAliveTimeout: how long to keep idle keep-alive connections open
server.keepAliveTimeout = Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 120000);