const cbor = require('cbor');
const base64url = require('base64url');

const decodeCborObject = (encryptedAppAttestObjectBase64) => {

    try {
         // Decode from base64url
        const decodedByteArray = base64url.toBuffer(encryptedAppAttestObjectBase64);
    
        // Decode from CBOR
        const decodedAppAttestObjectByteArray =
        cbor.decodeFirstSync(decodedByteArray);

        // Convert to a string
        // const decodedAppAttestObject = JSON.stringify(
        // decodedAppAttestObjectByteArray
        // );

        return decodedAppAttestObjectByteArray;
    } catch (error) {
        console.error('Error: Decoding Error.')
        console.error(error)
        return false
    }
   
}

module.exports = decodeCborObject