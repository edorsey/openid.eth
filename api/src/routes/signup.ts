import express from 'express'
import csrf from 'csurf'

// Sets up csrf protection
const csrfProtection = csrf({
  cookie: true
})

const router = express.Router()

router.get('/', csrfProtection, (req: any, res: any) => {
  res.render('signup', {
    csrfToken: req.csrfToken()
  })
})

router.post('/', csrfProtection, async (req: any, res: any) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
})

export default router
