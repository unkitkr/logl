import 'dotenv/config'
import express from 'express'
import { bodyParser, commandProcessor, messageParser } from './helpers'
const environmentVariables = process.env

const app = express()
const port = environmentVariables.PORT || 3000

app.use(express.json())

app.get('/ping', (req, res) => {
  res.send("I'm alive"), 200
})

app.post('/getmessage', (req, res) => {
  const body = req.body
  const recievedDetails = bodyParser(body)
  const parsedMessage = messageParser(recievedDetails.rawMessage)
  if (parsedMessage) {
    const processor = new commandProcessor({
      parsedMessage,
      rawData: recievedDetails,
    })
    processor.process()
  }
  res.send({
    success: true,
  }),
    200
})

app.listen(port, () => {
  console.log(`bot listening on port ${port}`)
})
