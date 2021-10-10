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

    let deviceChallenge
    let deviceChallengeSignature
    if (req.session.address) {
      deviceChallenge = await generateChallenge()

      await redisClient.set(
        deviceChallenge,
        JSON.stringify({
          address: req.session.address
        })
      )

      await redisClient.expire(deviceChallenge, 5 * 60)
    } else if (req.query.deviceChallenge) {
      const cachedChallengeJSON = await redisClient.get(
        req.query.deviceChallenge
      )
      if (cachedChallengeJSON) {
        deviceChallenge = req.query.deviceChallenge
        deviceChallengeSignature = req.query.deviceChallengeSignature
      } else {
        throw new Error('Challenge expired')
      }
    }

    res.render('add-device', {
      csrfToken: req.csrfToken(),
      action: urljoin(process.env.BASE_URL || '', '/add-device'),
      deviceChallenge,
      deviceChallengeSignature,
      profile: {}
    })
  })
)

router.post(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    const redisClient = req.app.get('redis')

    const {
      deviceChallenge,
      deviceChallengeSignature,
      deviceCredentialID,
      deviceCredential,
      deviceCredentialClientDataJSON
    } = req.body

    if (
      !(
        deviceChallenge &&
        deviceChallengeSignature &&
        deviceCredentialID &&
        deviceCredential &&
        deviceCredentialClientDataJSON
      )
    ) {
      throw new Error('Required property no specified')
    }

    const challengeAddress = ethers.utils.verifyMessage(
      deviceChallenge,
      deviceChallengeSignature
    )

    const cachedChallengeJSON = await redisClient.get(deviceChallenge)

    if (!cachedChallengeJSON) {
      throw new Error('Invalid challenge')
    }

    const { address } = JSON.parse(cachedChallengeJSON)

    if (challengeAddress !== address) {
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

    const identity = await req.getIdentity(challengeAddress)

    if (!identity) {
      throw new Error('Identity not found')
    }

    if (!identity.devices) {
      identity.devices = []
    }

    identity.devices.push({
      deviceCredentialID,
      deviceCredential,
      deviceCredentialClientData
    })

    await req.saveIdentity(challengeAddress, identity)

    if (!req.session?.address) {
      req.session.address = challengeAddress
    }

    res.redirect('/list-devices')
  })
)

export default router
