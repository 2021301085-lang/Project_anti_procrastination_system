const express = require('express')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()
const fs = require('fs')

const app = express()
const PORT = 3000

if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data')
}

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

const db = new sqlite3.Database('./data/tasks.db')

function today() {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date())
}

function initDatabase(callback) {
    db.serialize(() => {
        db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )
        `)

        db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            text TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            focus_time INTEGER DEFAULT 0
        )
        `)

        db.run(`
        CREATE TABLE IF NOT EXISTS focus_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            task_id INTEGER,
            time INTEGER,
            date TEXT
        )
        `)

        db.run(`
        CREATE TABLE IF NOT EXISTS daily_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            date TEXT,
            goal_time INTEGER DEFAULT 0,
            UNIQUE(user_id, date)
        )
        `)

        addMissingColumns(callback)
    })
}

function addMissingColumns(callback) {
    const jobs = [
        { table: 'tasks', column: 'user_id', definition: 'user_id INTEGER' },
        { table: 'tasks', column: 'focus_time', definition: 'focus_time INTEGER DEFAULT 0' },
        { table: 'tasks', column: 'completed', definition: 'completed INTEGER DEFAULT 0' }
    ]

    let finished = 0

    jobs.forEach(job => {
        db.all(`PRAGMA table_info(${job.table})`, [], (err, columns) => {
            if (err) {
                finished++
                if (finished === jobs.length) callback()
                return
            }

            const exists = columns.some(column => column.name === job.column)

            if (exists) {
                finished++
                if (finished === jobs.length) callback()
            } else {
                db.run(`ALTER TABLE ${job.table} ADD COLUMN ${job.definition}`, [], () => {
                    finished++
                    if (finished === jobs.length) callback()
                })
            }
        })
    })
}

app.get('/api/test', (req, res) => {
    res.json({ message: 'server working' })
})

app.post('/api/register', (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).send('아이디와 비밀번호를 입력하세요')
    }

    db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, password],
        function(err) {
            if (err) return res.status(500).send('이미 존재하는 사용자입니다')
            res.json({ message: '회원가입 완료' })
        }
    )
})

app.post('/api/login', (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).send('아이디와 비밀번호를 입력하세요')
    }

    db.get(
        'SELECT id, username FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, user) => {
            if (err) return res.status(500).send('DB 오류')
            if (!user) return res.status(401).send('로그인 실패')
            res.json({ user })
        }
    )
})

app.post('/api/tasks', (req, res) => {
    const { text, user_id } = req.body

    if (!user_id) {
        return res.status(400).send('user_id 없음')
    }

    if (!text || text.trim() === '') {
        return res.status(400).send('할 일을 입력하세요')
    }

    db.run(
        'INSERT INTO tasks (user_id, text) VALUES (?, ?)',
        [user_id, text.trim()],
        function(err) {
            if (err) return res.status(500).send('DB 오류')
            res.json({ id: this.lastID, user_id, text: text.trim(), completed: 0, focus_time: 0 })
        }
    )
})

app.get('/api/tasks/:user_id', (req, res) => {
    const user_id = req.params.user_id

    db.all(
        'SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC',
        [user_id],
        (err, rows) => {
            if (err) return res.status(500).send('DB 오류')
            res.json(rows)
        }
    )
})

app.put('/api/tasks/:id/toggle', (req, res) => {
    const id = req.params.id

    db.run(
        'UPDATE tasks SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END WHERE id = ?',
        [id],
        function(err) {
            if (err) return res.status(500).send('DB 오류')
            res.json({ message: 'updated' })
        }
    )
})

app.put('/api/tasks/:id/edit', (req, res) => {
    const id = req.params.id
    const { text } = req.body

    if (!text || text.trim() === '') {
        return res.status(400).send('수정할 내용을 입력하세요')
    }

    db.run(
        'UPDATE tasks SET text = ? WHERE id = ?',
        [text.trim(), id],
        function(err) {
            if (err) return res.status(500).send('DB 오류')
            res.json({ message: 'updated' })
        }
    )
})

app.delete('/api/tasks/:id', (req, res) => {
    const id = req.params.id

    db.run(
        'DELETE FROM tasks WHERE id = ?',
        [id],
        function(err) {
            if (err) return res.status(500).send('DB 오류')
            res.json({ message: 'deleted' })
        }
    )
})

app.put('/api/tasks/focus/:id', (req, res) => {
    const task_id = req.params.id
    const { time, user_id } = req.body
    const focusTime = Number(time)

    if (!user_id || !focusTime || focusTime <= 0) {
        return res.status(400).send('집중 시간 데이터 오류')
    }

    const date = today()

    db.run(
        'INSERT INTO focus_logs (user_id, task_id, time, date) VALUES (?, ?, ?, ?)',
        [user_id, task_id, focusTime, date],
        function(err) {
            if (err) return res.status(500).send('DB 오류')

            db.run(
                'UPDATE tasks SET focus_time = focus_time + ? WHERE id = ?',
                [focusTime, task_id],
                function(updateErr) {
                    if (updateErr) return res.status(500).send('DB 오류')
                    res.json({ message: 'focus saved' })
                }
            )
        }
    )
})

app.get('/api/focus/today/:user_id', (req, res) => {
    const user_id = req.params.user_id
    const date = today()

    db.get(
        'SELECT SUM(time) as total FROM focus_logs WHERE user_id = ? AND date = ?',
        [user_id, date],
        (err, row) => {
            if (err) return res.status(500).send('DB 오류')
            res.json({ total: row.total || 0 })
        }
    )
})

app.get('/api/focus/weekly/:user_id', (req, res) => {
    const user_id = req.params.user_id

    db.all(
        `
        SELECT date, SUM(time) as total
        FROM focus_logs
        WHERE user_id = ?
        GROUP BY date
        ORDER BY date DESC
        LIMIT 7
        `,
        [user_id],
        (err, rows) => {
            if (err) return res.status(500).send('DB 오류')
            res.json(rows.reverse())
        }
    )
})

app.get('/api/goal/today/:user_id', (req, res) => {
    const user_id = req.params.user_id
    const date = today()

    db.get(
        'SELECT goal_time FROM daily_goals WHERE user_id = ? AND date = ?',
        [user_id, date],
        (err, row) => {
            if (err) return res.status(500).send('DB 오류')
            res.json({ goal_time: row ? row.goal_time : 0 })
        }
    )
})

app.post('/api/goal/today', (req, res) => {
    const { user_id, goal_time } = req.body
    const goalTime = Number(goal_time)
    const date = today()

    if (!user_id || goalTime < 0) {
        return res.status(400).send('목표 시간 데이터 오류')
    }

    db.run(
        `
        INSERT INTO daily_goals (user_id, date, goal_time)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, date)
        DO UPDATE SET goal_time = excluded.goal_time
        `,
        [user_id, date, goalTime],
        function(err) {
            if (err) return res.status(500).send('DB 오류')
            res.json({ message: 'goal saved' })
        }
    )
})

initDatabase(() => {
    app.listen(PORT, () => {
        console.log('Server running on port ' + PORT)
    })
})

