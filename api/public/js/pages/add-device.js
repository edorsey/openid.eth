import * as ethers from '/js/modules/ethers/ethers.esm.min.js'
import { create } from '/js/modules/@github/webauthn-json/dist/main/webauthn-json.js'
import { default as base64urlEncode } from '/js/modules/base64url/dist/base64url.js'

console.log(base64urlEncode)

/**
 * Convert a hex string to an ArrayBuffer.
 *
 * @param {string} hexString - hex representation of bytes
 * @return {ArrayBuffer} - The bytes in an ArrayBuffer.
 */
function hexStringToArrayBuffer(hexString) {
  // remove the leading 0x
  hexString = hexString.replace(/^0x/, '')

  // ensure even number of characters
  if (hexString.length % 2 != 0) {
    console.log(
      'WARNING: expecting an even number of characters in the hexString'
    )
  }

  // check for some non-hex characters
  var bad = hexString.match(/[G-Z\s]/i)
  if (bad) {
    console.log('WARNING: found non-hex characters', bad)
  }

  // split the string into pairs of octets
  var pairs = hexString.match(/[\dA-F]{2}/gi)

  // convert the octets to integers
  var integers = pairs.map(function (s) {
    return parseInt(s, 16)
  })

  var array = new Uint8Array(integers)
  console.log(array)

  return array.buffer
}

async function addDevice(profile, challenge) {
  const encoder = new TextEncoder()

  console.log(base64urlEncode)
  const opts = {
    publicKey: {
      challenge: btoa(challenge),
      rp: {
        name: 'Decacube',
        id: 'localhost',
        icon: 'http://localhost:1999/login.ico'
      },
      user: {
        id: btoa(profile.address),
        name: profile.ensName,
        displayName: profile.ensName
      },
      pubKeyCredParams: [
        {
          type: 'public-key',
          alg: -7
        }
      ]
    }
  }
  console.log(opts)
  const credential = await create(opts)

  console.log('CRED', credential)

  return credential
}

const addDeviceButton = document.querySelector('#addDevice')
const deviceChallengeInput = document.querySelector('#deviceChallenge')
const assertDeviceButton = document.querySelector('#assertDevice')
const deviceChallengeSignatureInput = document.querySelector(
  '#deviceChallengeSignature'
)
const deviceCredentialIDInput = document.querySelector('#deviceCredentialID')
const deviceCredentialClientDataJSONInput = document.querySelector(
  '#deviceCredentialClientDataJSON'
)
const deviceCredentialInput = document.querySelector('#deviceCredential')

console.log(addDeviceButton, deviceChallengeInput)

addDeviceButton.addEventListener('click', async (e) => {
  const deviceIdentityChallenge = `${deviceChallengeInput.value}.${deviceChallengeSignatureInput.value}`
  console.log({ deviceIdentityChallenge })
  const credential = await addDevice(window.profile, deviceIdentityChallenge)
  deviceCredentialIDInput.value = credential.id

  deviceCredentialClientDataJSONInput.value = credential.response.clientDataJSON

  console.log(
    'CRED',
    credential,
    credential.response,
    JSON.stringify(credential.response)
  )

  const encoder = new TextEncoder()
  const attestationObject = encoder.encode(
    credential.response.attestationObject
  )
  const clientDataJSON = encoder.encode(credential.response.clientDataJSON)

  deviceCredentialInput.value = JSON.stringify({
    attestationObject,
    clientDataJSON
  })
})

assertDeviceButton.addEventListener('click', async (e) => {
  if (typeof window.ethereum !== 'undefined') {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner()
    const signature = await signer.signMessage(deviceChallenge.value)

    deviceChallengeSignatureInput.value = signature
  }
})
