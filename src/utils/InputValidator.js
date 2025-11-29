/**
 * Input validation utilities for secure App Attest operations
 */

/**
 * Validates base64 encoded string
 * @param {string} input - String to validate
 * @param {Object} options - Validation options
 * @returns {boolean} True if valid
 */
function isValidBase64(input, options = {}) {
    if (!input || typeof input !== 'string') return false;
    
    const { minLength = 1, maxLength = 1048576 } = options; // 1MB max
    
    if (input.length < minLength || input.length > maxLength) return false;
    
    // Base64 regex with optional padding
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(input);
}

/**
 * Validates base64url encoded string (used for CBOR data)
 * @param {string} input - String to validate
 * @param {Object} options - Validation options
 * @returns {boolean} True if valid
 */
function isValidBase64Url(input, options = {}) {
    if (!input || typeof input !== 'string') return false;
    
    const { minLength = 1, maxLength = 1048576 } = options; // 1MB max
    
    if (input.length < minLength || input.length > maxLength) return false;
    
    // Base64url regex (no padding)
    const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
    return base64UrlRegex.test(input);
}

/**
 * Validates device ID format
 * @param {string} deviceId - Device ID to validate
 * @returns {boolean} True if valid
 */
function isValidDeviceId(deviceId) {
    if (!deviceId || typeof deviceId !== 'string') return false;
    
    // UUID format or reasonable alternative (alphanumeric with hyphens, 8-64 chars)
    const deviceIdRegex = /^[a-zA-Z0-9-]{8,64}$/;
    return deviceIdRegex.test(deviceId);
}

/**
 * Validates keyId format
 * @param {string} keyId - Key ID to validate
 * @returns {boolean} True if valid
 */
function isValidKeyId(keyId) {
    if (!keyId || typeof keyId !== 'string') return false;
    
    // Base64 encoded SHA256 hash (44 characters)
    return isValidBase64(keyId, { minLength: 40, maxLength: 48 });
}

/**
 * Validates nonce format
 * @param {string} nonce - Nonce to validate
 * @returns {boolean} True if valid
 */
function isValidNonce(nonce) {
    if (!nonce || typeof nonce !== 'string') return false;
    
    // Accept either base64 encoded random bytes OR Unix timestamp
    // Base64 format (server-generated challenge)
    if (isValidBase64(nonce, { minLength: 16, maxLength: 64 })) {
        return true;
    }
    
    // Unix timestamp format (client-generated timestamp for assertions)
    const timestampRegex = /^\d{10,13}$/; // 10-13 digits for Unix timestamp
    if (timestampRegex.test(nonce)) {
        const timestamp = parseInt(nonce, 10);
        const now = Math.floor(Date.now() / 1000);
        // Allow timestamps within reasonable range (not too old or future)
        return timestamp > (now - 300) && timestamp < (now + 60); // 5 min past, 1 min future
    }
    
    return false;
}

/**
 * Validates assertion inputs header
 * @param {string} assertionInputs - Semicolon-separated header names
 * @returns {boolean} True if valid
 */
function isValidAssertionInputs(assertionInputs) {
    if (!assertionInputs || typeof assertionInputs !== 'string') return false;
    
    // Must be semicolon-separated header names (lowercase, alphanumeric with hyphens)
    const headerNames = assertionInputs.split(';');
    
    if (headerNames.length > 20) return false; // Reasonable limit
    
    const headerRegex = /^[a-z0-9-]{1,50}$/;
    return headerNames.every(name => name && headerRegex.test(name.trim()));
}

/**
 * Validates HTTP headers object
 * @param {Object} headers - Headers object to validate
 * @returns {Object} Validation result
 */
function validateHeaders(headers) {
    const errors = [];
    
    if (!headers || typeof headers !== 'object') {
        return { isValid: false, errors: ['Headers must be an object'] };
    }
    
    // Check required headers
    const requiredHeaders = ['device-id'];
    for (const header of requiredHeaders) {
        if (!headers[header]) {
            errors.push(`Missing required header: ${header}`);
        }
    }
    
    // Validate specific headers
    if (headers['device-id'] && !isValidDeviceId(headers['device-id'])) {
        errors.push('Invalid device-id format');
    }
    
    if (headers['key-id'] && !isValidKeyId(headers['key-id'])) {
        errors.push('Invalid key-id format');
    }
    
    if (headers['nonce'] && !isValidNonce(headers['nonce'])) {
        errors.push('Invalid nonce format');
    }
    
    if (headers['signature'] && !isValidBase64(headers['signature'])) {
        errors.push('Invalid signature format');
    }
    
    if (headers['assertion-inputs'] && !isValidAssertionInputs(headers['assertion-inputs'])) {
        errors.push('Invalid assertion-inputs format');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validates request body for attestation registration
 * @param {Object} body - Request body to validate
 * @returns {Object} Validation result
 */
function validateAttestationBody(body) {
    const errors = [];
    
    if (!body || typeof body !== 'object') {
        return { isValid: false, errors: ['Request body must be an object'] };
    }
    
    // Check required fields
    if (!body.keyId) {
        errors.push('Missing required field: keyId');
    } else if (!isValidKeyId(body.keyId)) {
        errors.push('Invalid keyId format');
    }
    
    if (!body.attestationObject) {
        errors.push('Missing required field: attestationObject');
    } else if (!isValidBase64(body.attestationObject, { minLength: 100, maxLength: 10000 })) {
        errors.push('Invalid attestationObject format');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Sanitizes string input for database operations
 * @param {string} input - Input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized input
 */
function sanitizeInput(input, options = {}) {
    if (!input || typeof input !== 'string') return '';
    
    const { maxLength = 1000, allowedChars } = options;
    
    // Trim and limit length
    let sanitized = input.trim().slice(0, maxLength);
    
    // Remove null bytes and other control characters
    sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');
    
    // Apply allowed characters filter if specified
    if (allowedChars) {
        const regex = new RegExp(`[^${allowedChars}]`, 'g');
        sanitized = sanitized.replace(regex, '');
    }
    
    return sanitized;
}

module.exports = {
    isValidBase64,
    isValidBase64Url,
    isValidDeviceId,
    isValidKeyId,
    isValidNonce,
    isValidAssertionInputs,
    validateHeaders,
    validateAttestationBody,
    sanitizeInput
}