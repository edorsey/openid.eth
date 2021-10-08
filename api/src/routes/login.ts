import express from 'express'
import csrf from 'csurf'
import urljoin from 'url-join'
import base64url from 'base64url'

import { hydraAdmin } from '../config'
import generateChallenge from '../helpers/generate-challenge'
import asyncRoute from '../helpers/async-route'

// Sets up csrf protection
const csrfProtection = csrf({
  cookie: true
})

const router = express.Router()

router.get(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    // The challenge is used to fetch information about the login request from ORY Hydra.
    const loginChallenge = Array.isArray(req.query.login_challenge)
      ? req.query.login_challenge[0]
      : req.query.login_challenge

    let loginRequest

    if (loginChallenge) {
      const { data } = await hydraAdmin.getLoginRequest(loginChallenge)
      loginRequest = data

      // If hydra was already able to authenticate the user, skip will be true and we do not need to re-authenticate
      // the user.
      if (loginRequest.skip) {
        const {
          data: { redirect_to: redirectTo }
        } = await hydraAdmin.acceptLoginRequest(loginChallenge, {
          subject: String(loginRequest.subject),
          remember: true,
          remember_for: 0 // 0 means it never expires
        })

        return res.redirect(redirectTo)
      }
    }

    const identity = await req.getIdentity()

    res.render('login', {
      csrfToken: req.csrfToken(),
      action: urljoin(process.env.BASE_URL || '', '/login'),
      deviceChallenge: await generateChallenge(),
      username: identity?.name,
      loginChallenge
    })
  })
)

router.post(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    const { username } = req.body
    if (!username) {
      throw new Error('No username provided')
    }

    let deviceUserHandle
    if (req.body.deviceUserHandle) {
      deviceUserHandle = base64url.decode(req.body.deviceUserHandle)
    }

    const { deviceCredentialID } = req.body
    if (!deviceCredentialID) {
      throw new Error('No deviceCredentialId provided')
    }

    let deviceAuthenticatorData
    if (!req.body.deviceAuthenticatorData) {
      throw new Error('No deviceAuthenticatorData provided')
    } else {
      deviceAuthenticatorData = req.body.deviceAuthenticatorData
    }

    let deviceClientDataJSON
    if (!req.body.deviceClientDataJSON) {
      throw new Error('No deviceClientDataJSON provided')
    } else {
      deviceClientDataJSON = base64url.decode(req.body.deviceClientDataJSON)
    }

    let addressForProvidedUsername
    try {
      addressForProvidedUsername = await req.ens.lookupAddressByName(username)
    } catch (err) {
      console.error(err)
      throw new Error('Failed to lookup username')
    }

    const { loginChallenge } = req.body

    console.log('LOGGING IN DEVICE', req.body, {
      deviceCredentialID,
      deviceUserHandle,
      addressForProvidedUsername,
      deviceAuthenticatorData,
      deviceClientDataJSON
    })

    const identity = await req.getIdentity(addressForProvidedUsername)
    if (!identity) {
      throw new Error('Identity not found')
    }

    const deviceCredential = identity.devices?.find(
      (device) => device.deviceCredentialID === deviceCredentialID
    )
    if (!deviceCredential) {
      throw new Error('Device credential not found')
    }

    const profile = await req.ens.lookupProfileByAddress(
      addressForProvidedUsername
    )
    await req.updateIdentity(addressForProvidedUsername, {
      ...profile,
      authenticatedAt: new Date()
    })

    req.session.address = addressForProvidedUsername

    if (loginChallenge) {
      // Seems like the user authenticated! Let's tell hydra...
      const { data: loginRequest } = await hydraAdmin.getLoginRequest(
        loginChallenge
      )

      const {
        data: { redirect_to: redirectTo, ...data }
      } = await hydraAdmin.acceptLoginRequest(loginChallenge, {
        // Subject is an alias for user ID. A subject can be a random string, a UUID, an email address, ....
        subject: addressForProvidedUsername,

        // This tells hydra to remember the browser and automatically authenticate the user in future requests. This will
        // set the "skip" parameter in the other route to true on subsequent requests!
        remember: true,

        // When the session expires, in seconds. Set this to 0 so it will never expire.
        remember_for: 0,

        // Sets which "level" (e.g. 2-factor authentication) of authentication the user has. The value is really arbitrary
        // and optional. In the context of OpenID Connect, a value of 0 indicates the lowest authorization level.
        acr: '5'
      })

      return res.redirect(redirectTo)
    }

    res.redirect('/profile')
  })
)

export default router
