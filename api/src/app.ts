import express, { NextFunction, Response, Request } from 'express'
import { promisify } from 'util'
import path from 'path'
import logger from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import session from 'express-session'
import redis from 'redis'

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

const RedisStore = require('connect-redis')(session)
const redisClient = redis.createClient({
  host: 'redis'
})
redisClient.on('error', (err) => console.log('REDIS ERROR', err))
redisClient.on('connect', (e) => console.log('REDIS CONNECTED', e))

const app = express()
app.set('redis', {
  get: promisify(redisClient.get).bind(redisClient),
  set: promisify(redisClient.set).bind(redisClient)
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

app.use((req: any, res, next) => {
  if (req.session.profile) {
    res.locals.profileJSON = JSON.stringify(req.session.profile, null, 2)
    res.locals.profile = req.session.profile
  }

  next()
})

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
app.listen(listenOn, () => {
  console.log(`Listening on http://0.0.0.0:${listenOn}`)
})
