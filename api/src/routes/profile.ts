import express from 'express'
import csrf from 'csurf'

// Sets up csrf protection
const csrfProtection = csrf({
  cookie: true
})

const router = express.Router()

router.get('/', csrfProtection, (req: any, res: any) => {
  res.render('profile', {
    csrfToken: req.csrfToken(),
    cookies: JSON.stringify(req.cookies, null, 2),
    session: JSON.stringify(req.session, null, 2),
    headers: JSON.stringify(req.headers, null, 2),
    profile: JSON.stringify(req.session.profile, null, 2)
  })
})

router.post('/', csrfProtection, async (req: any, res: any) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
})

export default router
