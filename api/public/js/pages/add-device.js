import * as ethers from '/js/modules/ethers/ethers.esm.min.js'
import * as webauthn from '/js/modules/@github/webauthn-json/dist/main/webauthn-json.js'

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

  return array.buffer
}

async function addDevice(profile, challenge) {
  const opts = {
    publicKey: {
      challenge: btoa(challenge),
      rp: {
        name: 'Decacube',
        id: window?.config?.domain,
        icon: 'http://localhost:1999/login.ico'
      },
      user: {
        id: btoa(profile.address),
        name: profile.name,
        displayName: profile.name
      },
      pubKeyCredParams: [
        {
          type: 'public-key',
          alg: -7
        }
      ]
    }
  }

  console.log(JSON.stringify(opts, null, 2))

  const credential = await webauthn.create(opts)

  return credential
}

const addDeviceForm = document.querySelector('#addDeviceForm')
const addLocalDeviceButton = document.querySelector('#addLocalDevice')
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
const waitingForSignatureDiv = document.querySelector('#waitingForSignature')
const metaMaskErrorDiv = document.querySelector('#metaMaskError')

assertDeviceButton.addEventListener('click', async (e) => {
  if (typeof window.ethereum !== 'undefined') {
    metaMaskErrorDiv.classList.add('is-hidden')

    const provider = new ethers.providers.Web3Provider(window.ethereum)
    const signer = provider.getSigner()

    waitingForSignatureDiv.classList.remove('is-hidden')
    assertDeviceButton.disabled = true
    const signature = await signer.signMessage(deviceChallenge.value)

    deviceChallengeSignatureInput.value = signature

    waitingForSignatureDiv.classList.add('is-hidden')

    moveToStep(2)

    assertDeviceButton.disabled = false
  } else {
    metaMaskErrorDiv.classList.remove('is-hidden')
  }
})

addLocalDeviceButton.addEventListener('click', async (e) => {
  const deviceIdentityChallenge = `${deviceChallengeInput.value}.${deviceChallengeSignatureInput.value}`
  const credential = await addDevice(window.profile, deviceIdentityChallenge)
  deviceCredentialIDInput.value = credential.id

  deviceCredentialClientDataJSONInput.value = credential.response.clientDataJSON

  deviceCredentialInput.value = credential.response.attestationObject

  addDeviceForm.submit()
})

const addRemoteDeviceButton = document.querySelector('#addRemoteDevice')
const remoteDeviceQRCodeDiv = document.querySelector('#remoteDeviceQRCode')
const remoteDeviceURLInput = document.querySelector('#remoteDeviceURL')
const csrfInput = document.querySelector('#csrf')
addRemoteDeviceButton.addEventListener('click', async (e) => {
  const url = `${window.location.href}?deviceChallenge=${deviceChallengeInput.value}&deviceChallengeSignature=${deviceChallengeSignatureInput.value}`
  new QRCode(remoteDeviceQRCodeDiv, {
    text: url
  })
  remoteDeviceURLInput.value = url

  moveToStep(3)
})

const stepEls = [
  document.querySelector('#step-1'),
  document.querySelector('#step-2'),
  document.querySelector('#step-3'),
  document.querySelector('#step-4')
]

function moveToStep(n) {
  stepEls.forEach((el, i) => {
    if (i === n - 1) {
      el.classList.remove('is-hidden')
    } else {
      el.classList.add('is-hidden')
    }
  })
}

if (deviceChallengeInput.value && deviceChallengeSignatureInput.value) {
  const address = ethers.utils.verifyMessage(
    deviceChallengeInput.value,
    deviceChallengeSignatureInput.value
  )

  if (!window.profile) {
    window.profile = {
      address
    }
  }

  console.log({ address })
  moveToStep(2)
}
