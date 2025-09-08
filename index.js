const express = require('express');
const connectDB = require('./config/db');
require('dotenv').config();
const app = express();

app.use(express.json());
app.use(require('cookie-parser')());
connectDB();

app.use('/api/auth', require('./routes/auth.router'));
app.use('/api/chat', require('./routes/conversation.router'));
app.listen(5555, ()=>{
    console.log('Server is running on port 5555');
})