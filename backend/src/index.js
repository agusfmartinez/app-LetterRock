require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { errorHandler } = require('./middleware/errorHandler')
const { limiter } = require('./middleware/rateLimit')
const searchRouter = require('./routes/search')
const artistsRouter = require('./routes/artists')
const albumsRouter = require('./routes/albums')
const tracksRouter = require('./routes/tracks')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(limiter)

app.use('/api/search', searchRouter)
app.use('/api/artists', artistsRouter)
app.use('/api/albums', albumsRouter)
app.use('/api/tracks', tracksRouter)

app.get('/health', (_, res) => res.json({ ok: true, env: process.env.NODE_ENV }))

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`LetterRock backend running on http://localhost:${PORT}`)
})
