const crypto = require('crypto');
const dbQuery = require("./utils/SQLiteHelper")
const { validateAttestation } = require("./AttestationValidator")
const { validateAttestationBody, validateHeaders, sanitizeInput } = require('./utils/InputValidator')

const registerAttestation = async (req, teamId, bundleIdentifier, DEV_MODE = false) => {
    if (!req) return { error: 'Request object is required' }
    if (!teamId) return { error: 'Team ID is required' }
    if (!bundleIdentifier) return { error: 'Bundle identifier is required' }
    if (typeof teamId !== 'string' || teamId.length !== 10) {
        return { error: 'Team ID must be a 10-character string' }
    }
    if (typeof bundleIdentifier !== 'string' || !bundleIdentifier.includes('.')) {
        return { error: 'Bundle identifier must be a valid reverse domain string' }
    }

    try {
        // Validate request body
        const bodyValidation = validateAttestationBody(req.body);
        if (!bodyValidation.isValid) {
            return { error: `Invalid request body: ${bodyValidation.errors.join(', ')}` }
        }

        // Validate headers
        const headerValidation = validateHeaders(req.headers);
        if (!headerValidation.isValid) {
            return { error: `Invalid headers: ${headerValidation.errors.join(', ')}` }
        }

        const { keyId, attestationObject } = req.body
        const deviceId = sanitizeInput(req.headers['device-id'], { maxLength: 64, allowedChars: 'a-zA-Z0-9-' })

        if (!keyId || !attestationObject || !deviceId) {
            return { error: 'Missing required fields: keyId, attestationObject, device-id' }
        }

        const nonceQuery = await dbQuery(`SELECT nonce FROM attestations WHERE deviceId = ?`, [deviceId])

        if (!nonceQuery[0] || !nonceQuery[0].nonce) {
            console.error('Error: Invalid or missing nonce for device:', deviceId)
            return { error: 'Device not found or nonce expired. Please request a new nonce.' }
        }

        const attestationResult = validateAttestation(nonceQuery[0].nonce, keyId, attestationObject, teamId, bundleIdentifier, DEV_MODE)
        if (!attestationResult.result) {

            if (attestationResult?.reason) {
                console.error(`Error: Attestation could not be validated - ${attestationResult.reason}`)
            } else {
                console.error('Error: Attestation could not be validated.')
            }
        
            return { error: 'Attestation could not be validated.' } //Validation failed
        }

        const publicKeyPEM = attestationResult.publicKeyPEM

    
        //Save public key PEM to db and keyId for later use:
        await dbQuery(`UPDATE attestations SET publicKey = ?, keyId = ?, updatedAt = CURRENT_TIMESTAMP WHERE deviceId = ?`, [publicKeyPEM, keyId, deviceId])

        return true
    } catch (error) {
        console.error('Error: Could not registering attestation: ', error)
        return { error: error }
    }
}

module.exports = registerAttestation