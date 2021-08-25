import express from 'express'

const router = express.Router()

router.get('/', (req, res) => {
  console.log("GET LOGIN", req.session, req.cookies)
  
  res.render('index')
})

export default router
