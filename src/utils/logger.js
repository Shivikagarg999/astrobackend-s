const winston = require('winston');
const path = require('path');

// Log file paths
const logDir = path.join(__dirname, '../../logs'); // Logs folder ka path

// Ensure log directory exists
const fs = require('fs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Create logger instance
const logger = winston.createLogger({
    level: 'info', // Default log level
    transports: [
        // Log to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        // Log to file
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error', // Only error level logs go into error.log
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

module.exports = logger;
