const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.ATTESTATION_DB_PATH || path.join(process.cwd(), 'attestations.db');
let db = null;
let dbConnectionError = null;

/**
 * Initialize database connection with proper error handling
 */
function initializeDatabase() {
    if (db && !dbConnectionError) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        // Ensure directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            try {
                fs.mkdirSync(dbDir, { recursive: true });
            } catch (error) {
                console.error('Failed to create database directory:', error.message);
                dbConnectionError = error;
                return reject(error);
            }
        }

        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                dbConnectionError = err;
                reject(err);
            } else {
                console.log('Database connection established');
                dbConnectionError = null;
                resolve();
            }
        });
    });
}

/**
 * Execute database query with connection retry logic
 * @param {string} query - SQL query to execute
 * @param {Array} args - Query parameters
 * @returns {Promise<Array>} Query results
 */
function dbQuery(query, args) {
    return new Promise(async (resolve, reject) => {
        try {
            // Initialize database if not connected
            if (!db || dbConnectionError) {
                await initializeDatabase();
            }

            db.all(query, args, (err, rows) => {
                if (err) {
                    console.error('Database query error:', err.message);
                    console.error('Query:', query);
                    console.error('Args:', args);
                    
                    // Check if it's a connection error and retry once
                    if (err.code === 'SQLITE_CANTOPEN' || err.code === 'SQLITE_NOTADB') {
                        console.log('Attempting to reconnect to database...');
                        dbConnectionError = err;
                        db = null;
                        
                        // Retry once
                        initializeDatabase()
                            .then(() => {
                                db.all(query, args, (retryErr, retryRows) => {
                                    if (retryErr) {
                                        reject(new Error(`Database error after retry: ${retryErr.message}`));
                                    } else {
                                        resolve(retryRows);
                                    }
                                });
                            })
                            .catch(reject);
                    } else {
                        reject(new Error(`Database query failed: ${err.message}`));
                    }
                } else {
                    resolve(rows);
                }
            });
        } catch (error) {
            reject(new Error(`Database initialization failed: ${error.message}`));
        }
    });
}

// Initialize database on module load
initializeDatabase().catch(err => {
    console.error('Failed to initialize database on startup:', err.message);
});

module.exports = dbQuery