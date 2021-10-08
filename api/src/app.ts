import { createServer } from 'http'
import { Server } from 'socket.io'
import express, { NextFunction, Response, Request } from 'express'
const { createAdapter } = require('@socket.io/redis-adapter')
import { promisify } from 'util'
import path from 'path'
import logger from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import session from 'express-session'
import redis from 'redis'
import connectRedis from 'connect-redis'
import { ethers } from 'ethers'

import routes from './routes'
import signup from './routes/signup'
import login from './routes/login'
import logout from './routes/logout'
import consent from './routes/consent'
import webauthn from './routes/webauthn'
import profile from './routes/profile'
import addDevice from './routes/add-device'
import loginDevice from './routes/login-device'
import listDevices from './routes/list-devices'
import webfinger from './routes/webfinger'
import asyncRoute from './helpers/async-route'

const RedisStore = connectRedis(session)
const redisClient = redis.createClient({
  host: 'redis'
})
redisClient.on('error', (err) => console.log('REDIS ERROR', err))
redisClient.on('connect', (e) => console.log('REDIS CONNECTED', e))

const ethereumProvider = new ethers.providers.InfuraProvider('homestead', {
  projectId: process.env.INFURA_PROJECT_ID
})

const app = express()

app.locals.domain = process.env.DOMAIN || 'auth-test.dorsey.io'
app.locals.title = process.env.TITLE || 'Decacube'

app.set('redis', {
  get: promisify(redisClient.get).bind(redisClient),
  set: promisify(redisClient.set).bind(redisClient),
  expire: promisify(redisClient.expire).bind(redisClient)
})

// view engine setup
app.set('views', path.join(__dirname, '..', 'views'))
app.set('view engine', 'pug')

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser(process.env.SESSION_SECRET))
app.use(express.static(path.join(__dirname, 'public')))

app.use(session({
  secret: process.env.SESSION_SECRET,
  rolling: true,
  resave: true,
}))

const webauthn = new WebAuthn({
  origin: 'https://auth.decacube.com',
  usernameField: 'username',
  userFields: {
    username: 'username',
    name: 'displayName',
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
const webauthnRouter = webauthn.initialize()
webauthnRouter.get('/', (req, res) => {
  res.render('webauthn')
})
app.use('/webauthn', webauthn.initialize())

app.use((req: any, res: any, next: NextFunction) => {
  const redisClient = req.app.get('redis')

  const getIdentity = async (addr) => {
    const address = addr || req.session.address || req.session.profile?.address
    console.log({ address })
    if (!address) return undefined

    const identityJSON = await redisClient.get(address)
    if (!identityJSON) return undefined

    const identity = JSON.parse(identityJSON)
    return identity
  }

  const getProfile = async (addr) => {
    const identity = await getIdentity(addr)

    if (!identity) {
      return undefined
    }

    const {
      address,
      chain,
      name,
      nameService,
      email,
      url,
      twitter,
      authenticatedAt,
      identifiedAt,
      signedUpAt
    } = identity

    return {
      address,
      chain,
      name,
      nameService,
      email,
      url,
      twitter,
      authenticatedAt,
      identifiedAt,
      signedUpAt
    }
  }

  const saveIdentity = async (address, identity) => {
    if (!identity) {
      identity = address
      address = req.session.address || req.session.profile.address
    }

    if (!address) {
      throw new Error('Could not determine an address')
    }

    await redisClient.set(address, JSON.stringify(identity))

    return identity
  }

  const updateIdentity = async (address, update) => {
    if (!update) {
      update = address
      address = req.session.address || req.session.profile.address
    }

    if (!address) {
      throw new Error('Could not determine an address')
    }

    const existingIdentity = await getIdentity(address)

    const updatedIdentity = {
      ...existingIdentity,
      update
    }

    const identity = await saveIdentity(address, updatedIdentity)

    return identity
  }

  req.getIdentity = getIdentity
  req.getProfile = getProfile
  req.saveIdentity = saveIdentity
  req.updateIdentity = updateIdentity

  next()
})

app.use((req: any, res, next) => {
  const redisClient = req.app.get('redis')

  const verifyMessageSignature = (message, signature) => {
    return ethers.utils.verifyMessage(message, signature)
  }

  const lookupAddressByName = async (name) => {
    const cacheKey = `ETH::ENS::name:${name}`

    const cachedAddress = await redisClient.get(cacheKey)
    if (cachedAddress) return cachedAddress

    const address = await ethereumProvider.resolveName(name)

    await redisClient.set(cacheKey, address)
    await redisClient.expire(cacheKey, 60 * 60)

    return address
  }

  const lookupNameByAddress = async (addr) => {
    const ensName = await ethereumProvider.lookupAddress(addr)

    return ensName
  }

  const lookupProfileByAddress = async (addr) => {
    const ensName = await lookupNameByAddress(addr)
    const resolver = await ethereumProvider.getResolver(ensName)

    const [email, url, twitter] = await Promise.all([
      resolver.getText('email'),
      resolver.getText('url'),
      resolver.getText('com.twitter')
    ])

    return {
      address: addr,
      chain: 'ETH',
      name: ensName,
      nameService: 'ENS',
      email,
      url,
      twitter
    }
  }

  req.ens = {
    verifyMessageSignature,
    ethereumProvider,
    lookupAddressByName,
    lookupNameByAddress,
    lookupProfileByAddress
  }

  next()
})

app.use(
  asyncRoute(async (req: any, res, next) => {
    const profile = await req.getProfile()
    if (profile) {
      res.locals.profileJSON = JSON.stringify(profile, null, 2)
      res.locals.profile = profile
    }

    next()
  })
)

app.use('/', routes)
app.use('/signup', signup)
app.use('/login', login)
app.use('/logout', logout)
app.use('/consent', consent)
app.use('/webauthn', webauthn)
app.use('/profile', profile)
app.use('/list-devices', listDevices)
app.use('/add-device', addDevice)
app.use('/login-device', loginDevice)
app.use('/.well-known/webfinger', webfinger)

// catch 404 and forward to error handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not found',
    statusCode: 404,
    result: 'error'
  })
})

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use((err: Error, req: Request, res: Response) => {
    res.status(500)
    res.render('error', {
      message: err.message,
      error: err
    })
  })
}

// production error handler
// no stacktraces leaked to user
app.use((err: Error, req: Request, res: Response) => {
  res.status(500)
  res.render('error', {
    message: err.message,
    error: {}
  })
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)
  res.status(500).render('error', {
    message: JSON.stringify(err, null, 2)
  })
})

const listenOn = Number(process.env.PORT || 3000)

const httpServer = createServer(app)
const pubClient = redisClient.duplicate()
const subClient = redisClient.duplicate()
const io = new Server(httpServer, {
  serveClient: true,
  adapter: createAdapter(pubClient, subClient)
})

io.on('connection', (socket) => {
  console.log('CONNECTION')
})

httpServer.listen(listenOn)
