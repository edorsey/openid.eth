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
  const { signature } = req.body
  const { idChallenge } = req.session

  const address = ethers.utils.verifyMessage(idChallenge, signature)

  const ensName = await provider.lookupAddress(address)

  const resolver = await provider.getResolver(ensName)

  const email = await resolver.getText('email')
  const url = await resolver.getText('url')
  const twitter = await resolver.getText('com.twitter')

  req.session.profile = {
    idChallenge,
    idSignature: req.body.signature,
    ensName,
    name: ensName,
    chain: 'ETH',
    nameService: 'ENS',
    address,
    email,
    url,
    twitter,
    authenticatedAt: new Date()
  }

  res.redirect('/profile')
})

export default router
