import express from 'express'
import csrf from 'csurf'
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
    const identity = await req.getIdentity()

    res.render('list-devices', {
      csrfToken: req.csrfToken(),
      action: urljoin(process.env.BASE_URL || '', '/list-devices'),
      username: identity?.name,
      devices: identity?.devices || []
    })
  })
)

router.post('/', csrfProtection, (req: any, res: any) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
  console.log('LOGGING IN DEVICE', req.body)

  res.json({
    ...req.body
  })
})

export default router
