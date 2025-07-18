# openid.eth

A simple service that allows you login to services that don't support Metamask/web3.0 with Open ID Connect instead. Eventually, it won't be [Ethereum-only](https://medium.com/metamask/metamasks-vision-for-multiple-network-support-4ffbee9ec64d)

Will use this to hook into Keycloak to allow users to login to their account with Metamask.

## Demo

https://github.com/user-attachments/assets/f3996aaa-d0eb-4909-a6cc-0ad0921295db

## Discontinued

I discontinued work on this after finding out about the [SpruceID SIWE-OIDC](https://github.com/spruceid/siwe-oidc) implementation.

## How it makes money

Allow users to pay ETH to [create an OpenID Connect client](https://www.ory.sh/hydra/docs/guides/oauth2-clients/).

## Generate a client

```
docker-compose exec hydra \
    hydra clients create \
    --endpoint http://localhost:4445/ \
    --id grafana11 \
    --scope openid \
    --grant-types authorization_code \
    --token-endpoint-auth-method none \
    --callbacks https://monitor.dorsey.io/login/generic_oauth
```
