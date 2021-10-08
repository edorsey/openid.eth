import * as webauthn from '/js/modules/@github/webauthn-json/dist/main/webauthn-json.js'

const loginForm = document.querySelector('form')
const usernameInput = document.querySelector('#username')
const authButton = document.querySelector('#auth')
const deviceChallengeInput = document.querySelector('#deviceChallenge')
const deviceCredentialIDInput = document.querySelector('#deviceCredentialID')
const deviceAuthenticatorDataInput = document.querySelector(
  '#deviceAuthenticatorData'
)
const deviceClientDataJSONInput = document.querySelector(
  '#deviceClientDataJSON'
)
const deviceSignatureInput = document.querySelector('#deviceSignature')
const deviceUserHandleInput = document.querySelector('#deviceUserHandle')
const loginErrorDiv = document.querySelector('#loginError')

authButton.addEventListener('click', async (e) => {
  let allowCredentials
  if (usernameInput.value) {
    const result = await fetch(
      `/.well-known/webfinger?resource=acct:${usernameInput.value}`
    )

    const account = await result.json()

    allowCredentials = account.properties.devices
      .filter((deviceCredentialID) => {
        return (
          deviceCredentialID !==
          '***REMOVED***'
        )
      })
      .map((deviceCredentialID) => {
        return {
          type: 'public-key',
          id: deviceCredentialID
        }
      })
  }

  const opts = {
    publicKey: {
      userVerification: 'preferred',
      rpId: window.config.domain,
      challenge: deviceChallengeInput.value,
      allowCredentials
    }
  }

  try {
    const credential = await webauthn.get(opts)

    console.log('CRED', credential)

    deviceCredentialIDInput.value = credential.id
    deviceAuthenticatorDataInput.value = credential.response.authenticatorData
    deviceClientDataJSONInput.value = credential.response.clientDataJSON
    deviceSignatureInput.value = credential.response.signature
    deviceUserHandleInput.value = credential.response.userHandle

    loginForm.submit()
  } catch (err) {
    console.error(err)
    loginErrorDiv.textContent = 'Error getting credential, try again.'
  }
})
