import express from 'express'
import csrf from 'csurf'
import { ethers } from 'ethers'
import generateChallenge from '../helpers/generate-challenge'
import asyncRoute from '../helpers/async-route'
import urljoin from 'url-join'
import base64url from 'base64url'

const provider = new ethers.providers.InfuraProvider('homestead', {
  projectId: process.env.INFURA_PROJECT_ID
})

// Sets up csrf protection
const csrfProtection = csrf({
  cookie: true
})

const router = express.Router()

router.get(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    res.render('login-device', {
      csrfToken: req.csrfToken(),
      action: urljoin(process.env.BASE_URL || '', '/login-device'),
      deviceChallenge: await generateChallenge(),
      username: req.session?.profile?.name
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
    if (!req.body.deviceUserHandle) {
      throw new Error('No device user handle provided')
    } else {
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

    const addressForProvidedUsername = await provider.resolveName(username)

    console.log('LOGGING IN DEVICE', req.body, {
      deviceCredentialID,
      deviceUserHandle,
      addressForProvidedUsername,
      deviceAuthenticatorData,
      deviceClientDataJSON
    })

    if (addressForProvidedUsername !== deviceUserHandle) {
      throw new Error('Username not associated with address')
    }

    const resolver = await provider.getResolver(username)

    const email = await resolver.getText('email')
    const url = await resolver.getText('url')
    const twitter = await resolver.getText('com.twitter')

    req.session.profile = {
      ensName: username,
      name: username,
      chain: 'ETH',
      nameService: 'ENS',
      address: deviceUserHandle,
      email,
      url,
      twitter,
      authenticatedWithCredentialId: deviceCredentialID,
      authenticatedAt: new Date()
    }

    res.json({
      ...req.body
    })
  })
)

export default router
