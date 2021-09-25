import base64url from 'base64url'
import { randomBytes } from 'crypto'

const generateChallenge = () => {
  return new Promise((resolve, reject) => {
    randomBytes(32, (err, buf) => {
      console.log(err, buf)
      if (err) return reject(err)
      resolve(base64url(buf))
    })
  })
}

export default generateChallenge
