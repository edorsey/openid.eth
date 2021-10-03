import express from 'express'
import url from 'url'
import urljoin from 'url-join'
import csrf from 'csurf'
import { ethers } from 'ethers'
import { hydraAdmin } from '../config'
import generateChallenge from '../helpers/generate-challenge'
import asyncRoute from '../helpers/async-route'

const provider = new ethers.providers.InfuraProvider("homestead", {
  projectId: process.env.INFURA_PROJECT_ID,
});

// Sets up csrf protection
const csrfProtection = csrf({
  cookie: true
})
const router = express.Router()

router.get(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    // Parses the URL query
    const query = url.parse(req.url, true).query

    // The challenge is used to fetch information about the login request from ORY Hydra.
    const loginChallenge = Array.isArray(query.login_challenge)
      ? query.login_challenge[0]
      : query.login_challenge

    let loginRequest

    if (loginChallenge) {
      const { data } = await hydraAdmin.getLoginRequest(loginChallenge)
      loginRequest = data

      // If hydra was already able to authenticate the user, skip will be true and we do not need to re-authenticate
      // the user.
      if (loginRequest.skip) {
        // You can apply logic here, for example update the number of times the user logged in.
        // ...

        // Now it's time to grant the login request. You could also deny the request if something went terribly wrong
        // (e.g. your arch-enemy logging in...)
        const {
          data: { redirect_to: redirectTo }
        } = await hydraAdmin.acceptLoginRequest(loginChallenge, {
          // All we need to do is to confirm that we indeed want to log in the user.
          subject: String(loginRequest.subject),

          remember: true,

          // When the session expires, in seconds. Set this to 0 so it will never expire.
          remember_for: 0
        })

        res.redirect(redirectTo)

        return
      }
    }

    const idChallenge = await generateChallenge()
    req.session.idChallenge = idChallenge

    // If authentication can't be skipped we MUST show the login UI.
    res.render('login', {
      csrfToken: req.csrfToken(),
      loginChallenge,
      idChallenge,
      action: urljoin(process.env.BASE_URL || '', '/login'),
      hint: loginRequest?.oidc_context?.login_hint || ''
    })
  })
)

router.post(
  '/',
  csrfProtection,
  asyncRoute(async (req: any, res: any) => {
    // The loginChallenge is now a hidden input field, so let's take it from the request body instead
    const { idChallenge, loginChallenge } = req.body

    // Let's see if the user decided to accept or reject the consent request..
    if (loginChallenge && req.body.submit === 'Deny access') {
      // Looks like the consent request was denied by the user
      const {
        data: { redirect_to: redirectTo }
      } = await hydraAdmin.rejectLoginRequest(loginChallenge, {
        error: 'access_denied',
        error_description: 'The resource owner denied the request'
      })
      res.redirect(redirectTo)
    }

    // Let's check if the user provided valid credentials. Of course, you'd use a database or some third-party service
    // for this!
    if (!req.body.address || !req.body.signature) {
      // Looks like the user provided invalid credentials, let's show the ui again...
      const idChallenge = await generateChallenge()
      req.session.idChallenge = idChallenge

      res.render('login', {
        csrfToken: req.csrfToken(),
        loginChallenge: loginChallenge,
        idChallenge,
        error: 'The username / password combination is not correct'
      })

      return
    }

    const address = ethers.utils.verifyMessage(idChallenge, req.body.signature)

    if (idChallenge !== req.session.idChallenge) {
      throw new Error('idChallenge did not match')
    }

    const ensName = await provider.lookupAddress(address)

    const resolver = await provider.getResolver(ensName)

    const email = await resolver.getText('email')
    const url = await resolver.getText('url')
    const twitter = await resolver.getText('com.twitter')

    req.session.profile = {
      idChallenge,
      idSignature: req.body.signature,
      ensName,
      name: ensName,
      chain: 'ETH',
      nameService: 'ENS',
      address,
      email,
      url,
      twitter,
      authenticatedAt: new Date()
    }

    if (loginChallenge) {
      // Seems like the user authenticated! Let's tell hydra...
      const { data: loginRequest } = await hydraAdmin.getLoginRequest(
        loginChallenge
      )

      const {
        data: { redirect_to: redirectTo, ...data }
      } = await hydraAdmin.acceptLoginRequest(loginChallenge, {
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
        acr: '5'
      })

      res.redirect(redirectTo)
    }

    res.redirect('/profile')

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
  })
)

export default router
