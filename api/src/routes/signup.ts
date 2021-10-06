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
    const challenge = await generateChallenge()

    res.render('signup', {
      csrfToken: req.csrfToken(),
      action: urljoin(process.env.BASE_URL || '', '/signup'),
      challenge
    })
  })
)

router.post('/', csrfProtection, async (req: any, res: any) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
  res.json(req.body)
})

export default router
