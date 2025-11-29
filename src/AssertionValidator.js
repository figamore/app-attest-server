const crypto = require('crypto');
const decodeCborObject = require('./utils/CBORDecoder');
const { computeSHA256 } = require('./utils/SHA256Compute');
const dbQuery = require('./utils/SQLiteHelper');
const { validateHeaders, sanitizeInput } = require('./utils/InputValidator');


function sortObjectKeys(jsonObj) {
  return Object.keys(jsonObj).sort().reduce((result, key) => {
    result[key] = jsonObj[key];
    return result;
  }, {});
}


/**
 * Validates a device assertion signature.
 *
 * @param {string} signature - The assertion signature generated in the client device.
 * @param {object} clientData - An object containing the key-value parameters of the request that were used to generate the assertion.
 * @param {string} keyPEM - The publicKey of credCert that you stored in your database during attestation/device registration.
 * @param {number} assertionsCount - The last known number of assertions that you stored in your database during the last assertion (0 for first assertion).
 * @param {string} teamId - Your 10 digit alphanumeric Apple Team ID.
 * @param {string} bundleIdentifier - The reverse network path bundle identifier of your app.
 * @returns {object} An object containing the result of the assertion validation, and the current assertions count, which you must store in the database for the next assertion.
 */
const verifyAssertion = (signature, clientData, keyPEM, assertionsCount, teamId, bundleIdentifier) => {

  // 1. Compute clientDataHash as the SHA256 hash of clientData.

  //Sort the object keys to ensure they match the order of clientData provided in iOS app. Use .sortedKeys in Swift
  const clientDataSorted = sortObjectKeys(clientData)
  let clientDataJsonString = JSON.stringify(clientDataSorted).replaceAll('/', '\\/')   //To conform with the output of Swift JSONEncoder.encode()
  let clientDataHash = computeSHA256(clientDataJsonString)


  //2. Concatenate authenticatorData and clientDataHash, and apply a SHA256 hash over the result to form nonce.
  const decodedAssertionObject = decodeCborObject(signature)
  const decodedSignature = decodedAssertionObject.signature
  const authenticatorData = decodedAssertionObject.authenticatorData
  const compositeItem = Buffer.concat([authenticatorData, clientDataHash])
  const compositeNonce = computeSHA256(compositeItem)


  //3. Use the public key that you store from the attestation object to verify that the assertion’s signature is valid for nonce.
  let keyObj = crypto.createPublicKey(Buffer.from(keyPEM))
  let verifier = crypto.createVerify('sha256').update(compositeNonce);
  let validSignature = verifier.verify(keyObj, decodedSignature);
  if (!validSignature) return {
    result: false,
    reason: 'Invalid signature.'
  }


  //4. Compute the SHA256 hash of the client’s App ID, and verify that it matches the RP ID in the authenticator data.
  const rpId = authenticatorData.slice(0, 32)
  const appIdHash = computeSHA256(teamId + '.' + bundleIdentifier)
  if (rpId.toString('hex') !== appIdHash.toString('hex')) return {
    result: false,
    reason: 'RP ID does not match SHA256 has of App ID'
  }


  //5. Verify that the authenticator data’s counter value is greater than the value from the previous assertion, or greater than 0 on the first assertion.
  const dataCounterHex = authenticatorData.slice(33, 37).toString('hex')
  const dataCounter = parseInt(dataCounterHex, 16)
  if (dataCounter <= assertionsCount) return {
    result: false,
    reason: 'The authenticator data counter value is less than the value from the previous assertion.'
  }


  //All conditions met - validation successful. Store the counter to use in step 5 when verifying the next assertion.
  return { result: true, counter: dataCounter }

}

//Returns true if the provided timestamp is older than (seconds)
function isTooOld(unixTimestamp, seconds) {
  const currentTime = Math.floor(Date.now() / 1000);
  const difference = currentTime - unixTimestamp;
  return difference > seconds
}

const validateAssertion = async (req, teamId, bundleIdentifier) => {

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
    // Validate headers first
    const headerValidation = validateHeaders(req.headers);
    if (!headerValidation.isValid) {
      return { error: `Invalid headers: ${headerValidation.errors.join(', ')}` }
    }

    const deviceId = sanitizeInput(req.headers["device-id"], { maxLength: 64, allowedChars: 'a-zA-Z0-9-' })
    const signature = req.headers["signature"]
    const keyId = sanitizeInput(req.headers["key-id"], { maxLength: 48, allowedChars: 'a-zA-Z0-9+/=' })
    const assertionInputs = sanitizeInput(req.headers["assertion-inputs"], { maxLength: 500, allowedChars: 'a-z0-9-;' })
    const nonce = sanitizeInput(req.headers["nonce"], { maxLength: 64, allowedChars: 'a-zA-Z0-9+/=' })

    if (!deviceId || !signature || !keyId || !assertionInputs || !nonce) {
      return { error: 'Missing or invalid required headers: device-id, signature, key-id, assertion-inputs, nonce' }
    }

    const maxSignatureAge = 120 //Reject tokens older than 120 seconds
    if (isTooOld(nonce, maxSignatureAge)) {
      console.error('Error: Signature is too old.')
      return { error: 'Signature is too old.' }
    }

    const keyQuery = await dbQuery(`SELECT publicKey, counter FROM attestations WHERE keyId = ? AND deviceId = ?`, [keyId, deviceId])

    if (!keyQuery[0]) {
      console.error('Error: No matching key found')
      return { error: 'nokey' }
    }


    //Build clientData from the assertion input:
    const clientDataKeys = assertionInputs.toLowerCase().split(';')
    const clientData = {}
    clientDataKeys.forEach(key => {
      if (req.headers[key] !== undefined) {
        clientData[key] = req.headers[key]
      }
    })



    const publicKey = keyQuery[0].publicKey
    const assertionsCount = keyQuery[0].counter

    const assertionResult = verifyAssertion(signature, clientData, publicKey, assertionsCount, teamId, bundleIdentifier)

    if (!assertionResult.result) {
      console.error('Error: Assertion could not be verified.')
      return { error: 'Assertion could not be verified' }
    }

    const newCounter = assertionResult.counter
    await dbQuery(`UPDATE attestations SET counter = ? WHERE keyId = ?`, [newCounter, keyId])

    return newCounter
  } catch (error) {
    console.error('Error: Assertion Error: ', error)
    return {error: error}
  }
}


module.exports = validateAssertion