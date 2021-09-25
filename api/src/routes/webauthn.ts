import WebAuthn from 'webauthn'

const webauthn = new WebAuthn({
  origin: 'http://localhost:1999',
  usernameField: 'username',
  userFields: {
    username: 'username',
    name: 'displayName'
  },
  // OR
  // store: {
  //   put: async (id, value) => {/* return <void> */},
  //   get: async (id) => {/* return User */},
  //   search: async (search) => {/* return { [username]: User } */},
  //   delete: async (id) => {/* return boolean */},
  // },
  rpName: 'auth.decacube.com',
  enableLogging: true
})

const router = webauthn.initialize()

router.get('/', (req: any, res: any) => {
  res.render('webauthn')
})

export default router
