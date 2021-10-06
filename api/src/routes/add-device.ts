import express from 'express'
import csrf from 'csurf'
import generateChallenge from '../helpers/generate-challenge'
import asyncRoute from '../helpers/async-route'
import urljoin from 'url-join'
import { ethers } from 'ethers'
import base64url from 'base64url'

// Sets up csrf protection
const csrfProtection = csrf({
  cookie: true
})

const router = express.Router()

router.get(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    const redisClient = req.app.get('redis')

    const identity = await redisClient.get(req.session.profile.address)
    console.log({ identity })

    const deviceChallenge = await generateChallenge()

    req.session.deviceChallenge = deviceChallenge

    res.render('add-device', {
      csrfToken: req.csrfToken(),
      action: urljoin(process.env.BASE_URL || '', '/add-device'),
      deviceChallenge
    })
  })
)

router.post(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    const redisClient = req.app.get('redis')

    let identity
    const identityJSON = await redisClient.get(req.session.profile.address)
    if (identityJSON) {
      identity = JSON.parse(identityJSON)
    }
    console.log({ identity })

    // The challenge is now a hidden input field, so let's take it from the request body instead
    const expectedDeviceChallenge = req.session.deviceChallenge
    delete req.session.deviceChallenge
    console.log('ADDING DEVICE', req.body, expectedDeviceChallenge)

    const {
      address,
      deviceChallenge,
      deviceChallengeSignature,
      deviceCredentialID,
      deviceCredential,
      deviceCredentialClientDataJSON
    } = req.body

    if (!req.session.profile.address) {
      throw new Error('No address in session')
    }

    if (deviceChallenge !== expectedDeviceChallenge) {
      throw new Error('deviceChallenge does not match.')
    }

    const challengeAddress = ethers.utils.verifyMessage(
      deviceChallenge,
      deviceChallengeSignature
    )

    if (challengeAddress !== req.session.profile.address) {
      throw new Error(
        "Address doesn't match address calculated from deviceChallengeSignature"
      )
    }

    console.log({
      address,
      deviceChallenge,
      deviceChallengeSignature,
      deviceCredentialClientDataJSON
    })

    let deviceCredentialClientData
    try {
      deviceCredentialClientData = JSON.parse(
        base64url.decode(deviceCredentialClientDataJSON)
      )
    } catch (err: any) {
      throw new Error(
        `Error parsing 'deviceCredentialClientDataJSON': ${err.message}`
      )
    }

    if (!identity) {
      identity = {
        name: req.session.profile.ensName,
        address: req.session.profile.address,
        website: req.session.profile.website,
        nameService: 'ENS',
        chain: 'ETH'
      }
    }

    if (!identity.devices) {
      identity.devices = []
    }

    identity.devices.push({
      deviceCredentialID,
      deviceCredential,
      deviceCredentialClientData
    })

    await redisClient.set(req.session.profile.address, JSON.stringify(identity))

    res.redirect('/list-devices')
  })
)

export default router
