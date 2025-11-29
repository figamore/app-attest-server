const validateAssertion = require("./AssertionValidator");
const { validateAttestation, getNonce } = require("./AttestationValidator");
const registerAttestation = require("./RegisterAttestation");
const dbQuery = require("./utils/SQLiteHelper");
const { logger } = require("./utils/Logger");

const initDb = async () => {
    try {
        const appAttestTableCreation = `CREATE TABLE IF NOT EXISTS attestations(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deviceId TEXT NOT NULL,
            nonce TEXT,
            keyId TEXT UNIQUE,
            publicKey TEXT,
            counter INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`

        await dbQuery(appAttestTableCreation, [])
        logger.info('Database initialized successfully')
    } catch (error) {
        logger.error('Failed to initialize database', { error: error.message })
        throw new Error('Failed to initialize attestation database')
    }
}

initDb()

module.exports = {
    validateAttestation,
    validateAssertion,
    getNonce,
    registerAttestation
}