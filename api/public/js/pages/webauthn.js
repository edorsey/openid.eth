import Client from '/js/modules/webauthn/client/Client.js'

const client = new Client({ pathPrefix: '/webauthn' })

await client.register({
  username: 'edorsey.eth',
  name: 'Eric Dorsey'
})

// ...

await client.login({ username: 'edorsey.eth' })

const publicKey = {
  challenge: '',
  rp: {
    name: 'Decacube',
    id: 'auth.decacube.com',
    icon: 'https://auth.decacube.com/login.ico'
  },
  user: {
    id: new Uint8Array(16),
    name: 'jdoe@example.com',
    displayName: 'John Doe'
  },
  pubKeyCredParams: [
    {
      type: 'public-key',
      alg: -7
    }
  ]
}

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

const credential = await navigator.credentials.create({ publicKey })

async function addDevice(profile, challenge) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Decacube',
        id: 'auth.decacube.com',
        icon: 'https://auth.decacube.com/login.ico'
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
  })
}
