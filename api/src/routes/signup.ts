import express from 'express'
import csrf from 'csurf'
import urljoin from 'url-join'
import { ethers } from 'ethers'

import asyncRoute from '../helpers/async-route'
import generateChallenge from '../helpers/generate-challenge'

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
    const idChallenge = await generateChallenge()

    req.session.idChallenge = idChallenge

    res.render('signup', {
      csrfToken: req.csrfToken(),
      action: urljoin(process.env.BASE_URL || '', '/signup'),
      idChallenge
    })
  })
)

router.post('/', csrfProtection, async (req: any, res: any) => {
  const redisClient = req.app.get('redis')

  const { signature } = req.body
  const { idChallenge } = req.session

  const address = ethers.utils.verifyMessage(idChallenge, signature)

  const ensName = await provider.lookupAddress(address)

  const resolver = await provider.getResolver(ensName)

  const email = await resolver.getText('email')
  const url = await resolver.getText('url')
  const twitter = await resolver.getText('com.twitter')

  const profile = {
    idChallenge,
    idSignature: signature,
    ensName,
    name: ensName,
    chain: 'ETH',
    nameService: 'ENS',
    address,
    email,
    url,
    twitter,
    identifiedAt: new Date(), // I think signup/registration should be called identification, since registration technically happens on chain
    signedUpAt: new Date()
  }

  req.session.address = address

  await req.updateIdentity(address, profile)

  res.redirect('/profile')
})

export default router
