import express from 'express'
import url from 'url'
import urljoin from 'url-join'
import csrf from 'csurf'
import { hydraAdmin } from '../config'

// Sets up csrf protection
const csrfProtection = csrf({ cookie: true })
const router = express.Router()

router.get('/', csrfProtection, (req, res, next) => {
  // Parses the URL query
  const query = url.parse(req.url, true).query

  // The challenge is used to fetch information about the logout request from ORY Hydra.
  const challenge = String(query.logout_challenge)
  // if (!challenge) {
  //   next(new Error('Expected a logout challenge to be set but received none.'))
  //   return
  // }

  if (challenge) {
    hydraAdmin
      .getLogoutRequest(challenge)
      // This will be called if the HTTP request was successful
      .then(() => {
        // Here we have access to e.g. response.subject, response.sid, ...

        // The most secure way to perform a logout request is by asking the user if he/she really want to log out.
        res.render('logout', {
          csrfToken: req.csrfToken(),
          challenge: challenge,
          action: urljoin(process.env.BASE_URL || '', '/logout')
        })
      })
      // This will handle any error that happens when making HTTP calls to hydra
      .catch(next)
  }

  res.render('logout', {
    csrfToken: req.csrfToken(),
    action: urljoin(process.env.BASE_URL || '', '/logout')
  })
})

router.post('/', csrfProtection, (req, res, next) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
  const challenge = req.body.challenge

  if (challenge) {
    if (req.body.submit === 'No') {
      return (
        hydraAdmin
          .rejectLogoutRequest(challenge)
          .then(() => {
            // The user did not want to log out. Let's redirect him back somewhere or do something else.
            res.redirect('https://www.ory.sh/')
          })
          // This will handle any error that happens when making HTTP calls to hydra
          .catch(next)
      )
    }

    // The user agreed to log out, let's accept the logout request.
    hydraAdmin
      .acceptLogoutRequest(challenge)
      .then(({ data: body }) => {
        req.session.destroy(() => {
          // All we need to do now is to redirect the user back to hydra!
          res.redirect(String(body.redirect_to))
        })
      })
      // This will handle any error that happens when making HTTP calls to hydra
      .catch(next)
  }

  console.log('DESTROYING SESSION', req.session)

  req.session.destroy(() => {
    // All we need to do now is to redirect the user back to hydra!
    res.redirect('/')
  })
})

export default router
