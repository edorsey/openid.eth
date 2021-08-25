import express, { NextFunction, Response, Request } from 'express'
import path from 'path'
import logger from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import session from 'express-session'

import routes from './routes'
import login from './routes/login'
import logout from './routes/logout'
import consent from './routes/consent'

const app = express()

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

app.use('/', routes)
app.use('/login', login)
app.use('/logout', logout)
app.use('/consent', consent)

// catch 404 and forward to error handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not found',
    statusCode: 404,
    result: "error"
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
