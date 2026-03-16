const express = require('express')
const path = require('path')

const app = express()
const PORT = 3000

app.use(express.static(path.join(__dirname, 'public')))

app.get('/api/test', (req, res) => {
    res.json({ message: "server working" })
})

app.listen(PORT, () => {
    console.log("Server running on port " + PORT)
})