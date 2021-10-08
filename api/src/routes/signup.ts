import express from 'express'
import csrf from 'csurf'
import urljoin from 'url-join'

import asyncRoute from '../helpers/async-route'
import generateChallenge from '../helpers/generate-challenge'

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

  const address = req.ens.verifyMessage(idChallenge, signature)

  const ensProfile = await req.ens.lookupProfileByAddress(address)

  const profile = {
    ...ensProfile,

    idChallenge,
    idSignature: signature,
    identifiedAt: new Date(), // I think signup/registration should be called identification, since registration technically happens on chain
    signedUpAt: new Date()
  }

  req.session.address = address

  await req.updateIdentity(address, profile)

  res.redirect('/profile')
})

export default router
