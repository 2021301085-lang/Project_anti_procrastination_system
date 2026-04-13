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
    completed INTEGER DEFAULT 0,
    focus_time INTEGER DEFAULT 0
)
`)

db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
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

app.put('/api/tasks/focus/:id', (req, res) => {
    const id = req.params.id
    const { time } = req.body

    db.run(
        'UPDATE tasks SET focus_time = focus_time + ? WHERE id = ?',
        [time, id],
        function(err) {
            if (err) return res.status(500).send(err)
            res.json({ message: 'focus time added' })
        }
    )
})


app.post('/api/login', (req, res) => {
    const { username, password } = req.body

    db.get(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, user) => {
            if (err) return res.status(500).send(err)
            if (!user) return res.status(401).send("로그인 실패")

            res.json({ message: '로그인 성공', user })
        }
    )
})


app.post('/api/register', (req, res) => {
    const { username, password } = req.body

    db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, password],
        function(err) {
            if (err) return res.status(500).send("이미 존재하는 사용자")
            res.json({ message: '회원가입 완료' })
        }
    )
})

