/**
 * Environment variable validation utilities for Apple App Attest
 */

/**
 * Validates Apple Team ID format
 * @param {string} teamId - The Team ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidTeamId(teamId) {
    if (!teamId || typeof teamId !== 'string') return false;
    
    // Team ID must be exactly 10 characters, alphanumeric
    const teamIdRegex = /^[A-Z0-9]{10}$/;
    return teamIdRegex.test(teamId);
}

/**
 * Validates bundle identifier format
 * @param {string} bundleId - The bundle identifier to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidBundleIdentifier(bundleId) {
    if (!bundleId || typeof bundleId !== 'string') return false;
    
    // Bundle ID must be reverse domain notation (e.g., com.company.app)
    const bundleIdRegex = /^[a-z0-9]+(\.[a-z0-9]+)+$/i;
    return bundleIdRegex.test(bundleId) && bundleId.includes('.');
}

/**
 * Validates database path format
 * @param {string} dbPath - The database path to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidDatabasePath(dbPath) {
    if (!dbPath || typeof dbPath !== 'string') return false;
    
    // Basic path validation - must end with .db and not contain dangerous characters
    const dangerousChars = /[<>:"|?*]/;
    return dbPath.endsWith('.db') && !dangerousChars.test(dbPath);
}

/**
 * Validates environment variables used by app-attest-server
 * @param {Object} options - Configuration options
 * @param {string} options.teamId - Apple Team ID
 * @param {string} options.bundleIdentifier - App bundle identifier
 * @param {string} [options.dbPath] - Optional database path
 * @returns {Object} Validation result
 */
function validateEnvironment(options = {}) {
    const errors = [];
    const warnings = [];

    const { teamId, bundleIdentifier, dbPath } = options;

    // Validate Team ID
    if (!teamId) {
        errors.push('APPLE_TEAM_ID is required');
    } else if (!isValidTeamId(teamId)) {
        errors.push('APPLE_TEAM_ID must be a 10-character alphanumeric string');
    }

    // Validate Bundle Identifier
    if (!bundleIdentifier) {
        errors.push('BUNDLE_IDENTIFIER is required');
    } else if (!isValidBundleIdentifier(bundleIdentifier)) {
        errors.push('BUNDLE_IDENTIFIER must be a valid reverse domain notation (e.g., com.company.app)');
    }

    // Validate database path if provided
    if (dbPath && !isValidDatabasePath(dbPath)) {
        warnings.push('ATTESTATION_DB_PATH should end with .db and not contain special characters');
    }

    // Environment-specific validations
    const nodeEnv = process.env.NODE_ENV;
    if (!nodeEnv) {
        warnings.push('NODE_ENV not set - defaulting to development mode');
    } else if (!['development', 'production', 'test'].includes(nodeEnv)) {
        warnings.push(`NODE_ENV value '${nodeEnv}' is not standard (use development, production, or test)`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validates and loads environment variables with helpful error messages
 * @returns {Object} Configuration object or throws error
 */
function loadAndValidateConfig() {
    const teamId = process.env.APPLE_TEAM_ID;
    const bundleIdentifier = process.env.BUNDLE_IDENTIFIER;
    const dbPath = process.env.ATTESTATION_DB_PATH;
    const nodeEnv = process.env.NODE_ENV || 'development';

    const validation = validateEnvironment({
        teamId,
        bundleIdentifier,
        dbPath
    });

    // Log warnings
    if (validation.warnings.length > 0) {
        console.warn('⚠️  Environment warnings:');
        validation.warnings.forEach(warning => console.warn(`   ${warning}`));
        console.warn('');
    }

    // Throw error if validation fails
    if (!validation.isValid) {
        console.error('❌ Environment validation failed:');
        validation.errors.forEach(error => console.error(`   ${error}`));
        console.error('\nRequired environment variables:');
        console.error('   APPLE_TEAM_ID=YOUR_10_CHAR_TEAM_ID');
        console.error('   BUNDLE_IDENTIFIER=com.your.app');
        console.error('\nOptional environment variables:');
        console.error('   NODE_ENV=production|development');
        console.error('   ATTESTATION_DB_PATH=./path/to/attestations.db');
        throw new Error('Environment validation failed. Please check your environment variables.');
    }

    return {
        teamId,
        bundleIdentifier,
        isDevelopment: nodeEnv !== 'production',
        dbPath: dbPath || './attestations.db'
    };
}

module.exports = {
    isValidTeamId,
    isValidBundleIdentifier,
    isValidDatabasePath,
    validateEnvironment,
    loadAndValidateConfig
}