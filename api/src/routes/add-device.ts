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
    if (req.session.profile?.address) {
      deviceChallenge = await generateChallenge()

      await redisClient.set(
        deviceChallenge,
        JSON.stringify({
          address: req.session.profile.address
        })
      )

      await redisClient.expire(deviceChallenge, 5 * 60)
    } else if (req.query.deviceChallenge) {
      deviceChallenge = req.query.deviceChallenge
      deviceChallengeSignature = req.query.deviceChallengeSignature
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

    let identity
    const identityJSON = await redisClient.get(challengeAddress)
    if (identityJSON) {
      identity = JSON.parse(identityJSON)
    }

    const { address } = JSON.parse(cachedChallengeJSON)

    if (challengeAddress !== address) {
      throw new Error(
        "Address doesn't match address calculated from deviceChallengeSignature"
      )
    }

    console.log({
      identity,
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
        name: req.session.profil?.ensName,
        address: challengeAddress,
        url: req.session.profile?.url,
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

    await redisClient.set(challengeAddress, JSON.stringify(identity))

    if (!req.session.profile?.address) {
      req.session.profile = {
        ensName: identity.name,
        name: identity.name,
        chain: identity.chain,
        nameService: identity.nameService,
        address: challengeAddress,
        email: identity.email,
        url: identity.url,
        twitter: identity.twitter,
        authenticatedWithCredentialId: deviceCredentialID,
        authenticatedAt: new Date()
      }
    }

    res.redirect('/list-devices')
  })
)

export default router
