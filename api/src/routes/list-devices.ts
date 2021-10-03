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
    const redisClient = req.app.get('redis')

    let identity
    const identityJSON = await redisClient.get(req.session.profile.address)
    if (identityJSON) {
      identity = JSON.parse(identityJSON)
    }
    console.log({ identity })

    res.render('list-devices', {
      csrfToken: req.csrfToken(),
      action: urljoin(process.env.BASE_URL || '', '/list-devices'),
      username: req.session.profile.name || req.session.profile.ensName,
      devices: identity.devices
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
