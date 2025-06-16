require('dotenv').config();
const express = require('express');
const cors = require('cors');
const masterRoute = require("./routes/masterRoute")
const path = require('path')
const logger = require('./utils/logger');
const app = express();
const session = require('express-session');

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));


app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60000 } // 1 minute
}));


//Master route
app.use('/api', masterRoute);

app.get('/', (req, res) => {
    res.send('Server is running');
});

global.croneJob = {};
// Error handler
app.use((err, req, res, next) => {
    logger.error(`Error occurred: ${err.message}`);  // Log error level message
    res.status(err.status || 500).json({ message: err.message || 'Something broke' });
});

module.exports = app;