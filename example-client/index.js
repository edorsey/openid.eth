const express = require("express");
const { auth } = require("express-openid-connect");

const app = express();
const port = process.env.PORT;

app.use(
  auth({
    issuerBaseURL: "https://hydra.decacube.com",
    baseURL: "http://localhost:4001",
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    clientAuthMethod: "client_secret_basic",
    secret: process.env.OIDC_SECRET,
    idpLogout: false,
    authorizationParams: {
      response_type: "code",
      scope: "openid",
    },
  })
);

app.get("/", (req, res) => {
  console.log(req.oidc.accessToken, req.oidc.idToken, req.oidc.user);
  res.send(`Hello, ${req.oidc.user.sub}`);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
