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

  const opts = {
    publicKey: {
      challenge: encoder.encode(challenge),
      rp: {
        name: 'Decacube',
        id: 'localhost',
        icon: 'http://localhost:1999/login.ico'
      },
      user: {
        id: hexStringToArrayBuffer(profile.address),
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
  const credential = await navigator.credentials.create(opts)
  console.log('CRED', credential)
}

const addDeviceButton = document.querySelector('#addDevice')
const deviceChallengeInput = document.querySelector('#deviceChallenge')

console.log(addDeviceButton, deviceChallengeInput)

addDeviceButton.addEventListener('click', (e) => {
  console.log('adding device', deviceChallengeInput.value)
  addDevice(window.profile, deviceChallengeInput.value)
})
