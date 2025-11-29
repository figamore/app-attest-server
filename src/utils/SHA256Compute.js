const crypto = require('crypto')


function computeSHA256(input) {
    const hash = crypto.createHash('sha256');
    hash.update(input);
    return hash.digest();
}

function computeSHA256Base64(input) {
    const hash = crypto.createHash('sha256');
    hash.update(input);
    return hash.digest('base64');
}

module.exports = { computeSHA256, computeSHA256Base64 }