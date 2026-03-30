const express = require('express')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const app = express()
const PORT = 3000

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

const db = new sqlite3.Database('./data/tasks.db')

db.run(`
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT,
    completed INTEGER DEFAULT 0
)
`)

app.get('/api/test', (req, res) => {
    res.json({ message: "server working" })
})

app.post('/api/tasks', (req, res) => {
    const { text } = req.body
    db.run('INSERT INTO tasks (text) VALUES (?)', [text], function(err) {
        if (err) return res.status(500).send(err)
        res.json({ id: this.lastID, text })
    })
})

app.get('/api/tasks', (req, res) => {
    db.all('SELECT * FROM tasks', [], (err, rows) => {
        if (err) return res.status(500).send(err)
        res.json(rows)
    })
})

app.put('/api/tasks/:id', (req, res) => {
    const id = req.params.id
    db.run(
        'UPDATE tasks SET completed = NOT completed WHERE id = ?',
        [id],
        function(err) {
            if (err) return res.status(500).send(err)
            res.json({ message: 'updated' })
        }
    )
})

app.put('/api/tasks/edit/:id', (req, res) => {
    const id = req.params.id
    const { text } = req.body

    db.run(
        'UPDATE tasks SET text = ? WHERE id = ?',
        [text, id],
        function(err) {
            if (err) return res.status(500).send(err)
            res.json({ message: 'updated' })
        }
    )
})

app.delete('/api/tasks/:id', (req, res) => {
    const id = req.params.id

    db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).send(err)
        res.json({ message: 'deleted' })
    })
})

app.listen(PORT, () => {
    console.log('Server running on port ' + PORT)
})
