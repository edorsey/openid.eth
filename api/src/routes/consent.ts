import express from 'express'
import url from 'url'
import urljoin from 'url-join'
import csrf from 'csurf'
import { ethers } from 'ethers'
import { hydraAdmin } from '../config'
import { oidcConformityMaybeFakeSession } from './stub/oidc-cert'
import { ConsentRequestSession } from '@oryd/hydra-client'

const provider = new ethers.providers.InfuraProvider("homestead", {
  projectId: process.env.INFURA_PROJECT_ID,
});

// Sets up csrf protection
const csrfProtection = csrf({ cookie: true })
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

  // The challenge is used to fetch information about the consent request from ORY hydraAdmin.
  const challenge = String(query.consent_challenge)
  if (!challenge) {
    throw new Error('Expected a consent challenge to be set but received none.')
  }


  // This section processes consent requests and either shows the consent UI or
  // accepts the consent request right away if the user has given consent to this
  // app before
  const {data: consentRequest} = await hydraAdmin.getConsentRequest(challenge)

  if (!consentRequest.subject) {
    throw new Error('Consent Request has no subject')
  }

  const address = consentRequest.subject

  const ens = await provider.lookupAddress(address)
  
  const resolver = await provider.getResolver(ens)
  const [ensEmail, ensURL, ensTwitter] = await Promise.all([
    resolver.getText("email"),
    resolver.getText("url"),
    resolver.getText("com.twitter")
  ]);
  
  // If a user has granted this application the requested scope, hydra will tell us to not show the UI.
  if (consentRequest.skip) {
    // You can apply logic here, for example grant another scope, or do whatever...
    // ...

    // Now it's time to grant the consent request. You could also deny the request if something went terribly wrong
    const { data: acceptConsentRequestResponse } = await hydraAdmin
      .acceptConsentRequest(challenge, {
        // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
        // are requested accidentally.
        grant_scope: consentRequest.requested_scope,

        // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
        grant_access_token_audience: consentRequest.requested_access_token_audience,

        remember: true,

        remember_for: 0,

        // The session allows us to set session data for id and access tokens
        session: {
          // This data will be available when introspecting the token. Try to avoid sensitive information here,
          // unless you limit who can introspect tokens.
          // accessToken: { foo: 'bar' },
          // This data will be available in the ID token.
          // idToken: { baz: 'bar' },
          access_token: {
            ens,
            address,
          },
          id_token: {
            email: ensEmail,
            url: ensURL,
            twitter: ensTwitter,
            address,
            ens,
          }
        }
      })

      console.log("ACCEPT CONSENT REQUEST", acceptConsentRequestResponse.redirect_to, acceptConsentRequestResponse)
      
      res.redirect(acceptConsentRequestResponse.redirect_to)

      return
  }

  // If consent can't be skipped we MUST show the consent UI.
  res.render('consent', {
    csrfToken: req.csrfToken(),
    challenge: challenge,
    // We have a bunch of data available from the response, check out the API docs to find what these values mean
    // and what additional data you have available.
    requested_scope: consentRequest.requested_scope,
    user: consentRequest.subject,
    client: consentRequest.client,
    action: urljoin(process.env.BASE_URL || '', '/consent')
  })

  // The consent request has now either been accepted automatically or rendered.
}))

router.post('/', csrfProtection, asyncRoute(async (req: any, res: any) => {
  // The challenge is now a hidden input field, so let's take it from the request body instead
  const challenge = req.body.challenge

  // Let's see if the user decided to accept or reject the consent request..
  if (req.body.submit === 'Deny access') {
    // Looks like the consent request was denied by the user
    const { data: {redirect_to: redirectTo} } = await hydraAdmin.rejectConsentRequest(challenge, {
      error: 'access_denied',
      error_description: 'The resource owner denied the request'
    })
      
    // All we need to do now is to redirect the browser back to hydra!
    res.redirect(redirectTo)

  }
  // label:consent-deny-end

  let grantScope = req.body.grant_scope
  if (!Array.isArray(grantScope)) {
    grantScope = [grantScope]
  }


  // Let's fetch the consent request again to be able to set `grantAccessTokenAudience` properly.
  const {data: consentRequest} = await hydraAdmin.getConsentRequest(challenge)
  
  if (!consentRequest.subject) {
    throw new Error('Consent Request has no subject')
  }

  const address = consentRequest.subject

  const ens = await provider.lookupAddress(address)
  
  const resolver = await provider.getResolver(ens)
  const [ensEmail, ensURL, ensTwitter] = await Promise.all([
    resolver.getText("email"),
    resolver.getText("url"),
    resolver.getText("com.twitter")
  ]);

  // The session allows us to set session data for id and access tokens
  let session: ConsentRequestSession = {
    // This data will be available when introspecting the token. Try to avoid sensitive information here,
    // unless you limit who can introspect tokens.
    access_token: {
      address,
      ens,
    },

    // This data will be available in the ID token.
    id_token: {
      address,
      ens,
      email: ensEmail,
      url: ensURL,
      twitter: ensTwitter
    }
  }

  // Here is also the place to add data to the ID or access token. For example,
  // if the scope 'profile' is added, add the family and given name to the ID Token claims:
  // if (grantScope.indexOf('profile')) {
  //   session.id_token.family_name = 'Doe'
  //   session.id_token.given_name = 'John'
  // }

  // This will be called if the HTTP request was successful
      
  const {data: acceptConsentRequestResponse} = await hydraAdmin.acceptConsentRequest(challenge, {
    // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
    // are requested accidentally.
    grant_scope: grantScope,

    // If the environment variable CONFORMITY_FAKE_CLAIMS is set we are assuming that
    // the app is built for the automated OpenID Connect Conformity Test Suite. You
    // can peak inside the code for some ideas, but be aware that all data is fake
    // and this only exists to fake a login system which works in accordance to OpenID Connect.
    //
    // If that variable is not set, the session will be used as-is.
    
    session: oidcConformityMaybeFakeSession(grantScope, consentRequest, session),

    // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
    grant_access_token_audience: consentRequest.requested_access_token_audience,

    // This tells hydra to remember this consent request and allow the same client to request the same
    // scopes from the same user, without showing the UI, in the future.
    remember: Boolean(req.body.remember),

    // When this "remember" sesion expires, in seconds. Set this to 0 so it will never expire.
    remember_for: 0
  })
  
          // All we need to do now is to redirect the user back to hydra!
  res.redirect(acceptConsentRequestResponse.redirect_to)
}))

export default router
