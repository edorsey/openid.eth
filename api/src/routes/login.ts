import express from 'express'
import url from 'url'
import urljoin from 'url-join'
import csrf from 'csurf'
import { ethers } from 'ethers'
import { hydraAdmin } from '../config'
import { oidcConformityMaybeFakeAcr } from './stub/oidc-cert'

const provider = new ethers.providers.InfuraProvider("homestead", {
  projectId: process.env.INFURA_PROJECT_ID,
});

// Sets up csrf protection
const csrfProtection = csrf({ 
  cookie: true
})
const router = express.Router()

const asyncRoute = (route: any) => {
  return async (req: any, res: any, next: any) => {
    try {
      await route(req, res, next)
    } catch (err) {
      return next(err)
    }
  }
}

router.get('/', csrfProtection, asyncRoute(async (req: any, res: any) => {
  // Parses the URL query
  const query = url.parse(req.url, true).query

  // The challenge is used to fetch information about the login request from ORY Hydra.
  const challenge = Array.isArray(query.login_challenge) ? query.login_challenge[0] : query.login_challenge

  if (!challenge) {
    throw new Error('Expected a login challenge to be set but received none.')
  }

  const {data: loginRequest} = await hydraAdmin.getLoginRequest(challenge)

  // If hydra was already able to authenticate the user, skip will be true and we do not need to re-authenticate
  // the user.
  if (loginRequest.skip) {
    // You can apply logic here, for example update the number of times the user logged in.
    // ...

    // Now it's time to grant the login request. You could also deny the request if something went terribly wrong
    // (e.g. your arch-enemy logging in...)
    const {data: { redirect_to: redirectTo} } = await hydraAdmin.acceptLoginRequest(challenge, {
      // All we need to do is to confirm that we indeed want to log in the user.
      subject: String(loginRequest.subject),

      remember: true,

      // When the session expires, in seconds. Set this to 0 so it will never expire.
      remember_for: 0
    })
          
    res.redirect(redirectTo)

    return
  }

  if (req.session.sub && challenge) {
    const { data: {redirect_to: redirectTo, ...data} } = await hydraAdmin
      .acceptLoginRequest(challenge, {
        // Subject is an alias for user ID. A subject can be a random string, a UUID, an email address, ....
        subject: req.session.sub,

        // This tells hydra to remember the browser and automatically authenticate the user in future requests. This will
        // set the "skip" parameter in the other route to true on subsequent requests!
        remember: Boolean(req.query.remember),

        // When the session expires, in seconds. Set this to 0 so it will never expire.
        remember_for: 3600,

        // Sets which "level" (e.g. 2-factor authentication) of authentication the user has. The value is really arbitrary
        // and optional. In the context of OpenID Connect, a value of 0 indicates the lowest authorization level.
        // acr: '0',
        //
        // If the environment variable CONFORMITY_FAKE_CLAIMS is set we are assuming that
        // the app is built for the automated OpenID Connect Conformity Test Suite. You
        // can peak inside the code for some ideas, but be aware that all data is fake
        // and this only exists to fake a login system which works in accordance to OpenID Connect.
        //
        // If that variable is not set, the ACR value will be set to the default passed here ('0')
        acr: oidcConformityMaybeFakeAcr(loginRequest, '0')
      })

    res.redirect(redirectTo)

    return
  } 

  // If authentication can't be skipped we MUST show the login UI.
  res.render('login', {
    csrfToken: req.csrfToken(),
    challenge: challenge,
    action: urljoin(process.env.BASE_URL || '', '/login'),
    hint: loginRequest.oidc_context?.login_hint || ''
  })
}))

router.post('/', csrfProtection, asyncRoute(async (req: any, res: any) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
  const challenge = req.body.challenge

  // Let's see if the user decided to accept or reject the consent request..
  if (req.body.submit === 'Deny access') {
    // Looks like the consent request was denied by the user
    const {data: {redirect_to: redirectTo}} = await hydraAdmin
      .rejectLoginRequest(challenge, {
        error: 'access_denied',
        error_description: 'The resource owner denied the request'
      })

      res.redirect(redirectTo)
  }


  // Let's check if the user provided valid credentials. Of course, you'd use a database or some third-party service
  // for this!
  if (!req.body.address || !req.body.signature) {
    // Looks like the user provided invalid credentials, let's show the ui again...

    res.render('login', {
      csrfToken: req.csrfToken(),
      challenge: challenge,
      error: 'The username / password combination is not correct'
    })

    return
  }

  const address = ethers.utils.verifyMessage(challenge, req.body.signature)

  // Seems like the user authenticated! Let's tell hydra...
  const { data: loginRequest } = await hydraAdmin.getLoginRequest(challenge)


  const { data: {redirect_to: redirectTo, ...data} } = await hydraAdmin
    .acceptLoginRequest(challenge, {
      // Subject is an alias for user ID. A subject can be a random string, a UUID, an email address, ....
      subject: address,

      // This tells hydra to remember the browser and automatically authenticate the user in future requests. This will
      // set the "skip" parameter in the other route to true on subsequent requests!
      remember: true,

      // When the session expires, in seconds. Set this to 0 so it will never expire.
      remember_for: 0,

      // Sets which "level" (e.g. 2-factor authentication) of authentication the user has. The value is really arbitrary
      // and optional. In the context of OpenID Connect, a value of 0 indicates the lowest authorization level.
      // acr: '0',
      //
      // If the environment variable CONFORMITY_FAKE_CLAIMS is set we are assuming that
      // the app is built for the automated OpenID Connect Conformity Test Suite. You
      // can peak inside the code for some ideas, but be aware that all data is fake
      // and this only exists to fake a login system which works in accordance to OpenID Connect.
      //
      // If that variable is not set, the ACR value will be set to the default passed here ('0')
      acr: oidcConformityMaybeFakeAcr(loginRequest, '0')
    })

  req.session.sub = address
     
  res.redirect(redirectTo)


  // You could also deny the login request which tells hydra that no one authenticated!
  // hydra.rejectLoginRequest(challenge, {
  //   error: 'invalid_request',
  //   errorDescription: 'The user did something stupid...'
  // })
  //   .then(({body}) => {
  //     // All we need to do now is to redirect the browser back to hydra!
  //     res.redirect(String(body.redirectTo));
  //   })
  //   // This will handle any error that happens when making HTTP calls to hydra
  //   .catch(next);
}))

export default router
