import express from 'express'
import csrf from 'csurf'
import asyncRoute from '../helpers/async-route'

// Sets up csrf protection
const csrfProtection = csrf({
  cookie: true
})

const router = express.Router()

router.get(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    const resource = req.query.resource
    console.log({ resource })

    const username = resource.replace('acct:', '')
    if (!username) {
      return res.json({})
    }

    const address = await req.ens.lookupAddressByName(username)
    if (!address) {
      return res.json({})
    }
    console.log('ADDRESS', address)

    const identity = await req.getIdentity(address)

    if (!identity) {
      return res.json({
        subject: resource,
        properties: {
          username,
          address,
          devices: []
        }
      })
    }

    res.json({
      subject: resource,
      properties: {
        username,
        address,
        devices: identity.devices.map(({ deviceCredentialID }) => {
          return deviceCredentialID
        })
      }
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
