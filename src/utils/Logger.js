/**
 * Logging utility for app-attest-server with configurable levels and formatting
 */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const LEVEL_NAMES = {
    [LOG_LEVELS.ERROR]: 'ERROR',
    [LOG_LEVELS.WARN]: 'WARN',
    [LOG_LEVELS.INFO]: 'INFO',
    [LOG_LEVELS.DEBUG]: 'DEBUG'
};

class Logger {
    constructor(options = {}) {
        this.level = this.parseLogLevel(process.env.LOG_LEVEL || options.level || 'INFO');
        this.enableTimestamp = options.enableTimestamp !== false;
        this.enableColors = options.enableColors !== false && process.stdout.isTTY;
        this.prefix = options.prefix || 'app-attest-server';
    }

    parseLogLevel(level) {
        if (typeof level === 'number') return level;
        const upperLevel = level.toUpperCase();
        return LOG_LEVELS[upperLevel] !== undefined ? LOG_LEVELS[upperLevel] : LOG_LEVELS.INFO;
    }

    formatMessage(level, message, extra = {}) {
        const parts = [];
        
        if (this.enableTimestamp) {
            parts.push(new Date().toISOString());
        }
        
        const levelName = LEVEL_NAMES[level] || 'INFO';
        
        if (this.enableColors) {
            const colors = {
                [LOG_LEVELS.ERROR]: '\x1b[31m', // Red
                [LOG_LEVELS.WARN]: '\x1b[33m',  // Yellow
                [LOG_LEVELS.INFO]: '\x1b[36m',  // Cyan
                [LOG_LEVELS.DEBUG]: '\x1b[37m'  // White
            };
            parts.push(`${colors[level]}[${levelName}]\x1b[0m`);
        } else {
            parts.push(`[${levelName}]`);
        }
        
        parts.push(`[${this.prefix}]`);
        parts.push(message);
        
        // Add extra data if provided
        if (Object.keys(extra).length > 0) {
            parts.push(JSON.stringify(extra));
        }
        
        return parts.join(' ');
    }

    log(level, message, extra) {
        if (level <= this.level) {
            const formattedMessage = this.formatMessage(level, message, extra);
            
            if (level === LOG_LEVELS.ERROR) {
                console.error(formattedMessage);
            } else {
                console.log(formattedMessage);
            }
        }
    }

    error(message, extra) {
        this.log(LOG_LEVELS.ERROR, message, extra);
    }

    warn(message, extra) {
        this.log(LOG_LEVELS.WARN, message, extra);
    }

    info(message, extra) {
        this.log(LOG_LEVELS.INFO, message, extra);
    }

    debug(message, extra) {
        this.log(LOG_LEVELS.DEBUG, message, extra);
    }

    // Security-focused logging methods
    securityEvent(event, details = {}) {
        this.error(`Security Event: ${event}`, {
            timestamp: new Date().toISOString(),
            ...details
        });
    }

    attestationEvent(event, deviceId, details = {}) {
        this.info(`Attestation: ${event}`, {
            deviceId: deviceId ? deviceId.substring(0, 8) + '...' : 'unknown',
            ...details
        });
    }

    validationError(context, error, sanitizedData = {}) {
        this.error(`Validation failed in ${context}`, {
            error: error.message || error,
            ...sanitizedData
        });
    }
}

// Create default logger instance
const logger = new Logger();

// Export both the class and default instance
module.exports = {
    Logger,
    logger,
    LOG_LEVELS
}