import Client from '/js/modules/webauthn/client/Client.js'

const client = new Client({ pathPrefix: '/webauthn' })

await client.register({
  username: 'edorsey.eth',
  name: 'Eric Dorsey'
})

// ...

await client.login({ username: 'edorsey.eth' })
