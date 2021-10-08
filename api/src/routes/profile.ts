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
    res.render('profile', {
      csrfToken: req.csrfToken(),
      cookiesJSON: JSON.stringify(req.cookies, null, 2),
      sessionJSON: JSON.stringify(req.session, null, 2),
      headersJSON: JSON.stringify(req.headers, null, 2)
    })
  })
)

router.post('/', csrfProtection, async (req: any, res: any) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
})

export default router
