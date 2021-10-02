import express from 'express'
import csrf from 'csurf'
import generateChallenge from '../helpers/generate-challenge'
import asyncRoute from '../helpers/async-route'
import urljoin from 'url-join'

// Sets up csrf protection
const csrfProtection = csrf({
  cookie: true
})

const router = express.Router()

router.get(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    res.render('add-device', {
      csrfToken: req.csrfToken(),
      action: urljoin(process.env.BASE_URL || '', '/add-device'),
      profile: JSON.stringify(req.session.profile, null, 2),
      deviceChallenge: await generateChallenge(),
      idChallenge: req.session.profile?.idChallenge,
      address: req.session.profile?.address,
      ensName: req.session.profile?.ensName
    })
  })
)

router.post('/', csrfProtection, (req: any, res: any) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
  console.log('ADDING DEVICE', req.body)

  res.json({
    ...req.body
  })
})

export default router
