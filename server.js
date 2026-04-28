const express = require('express')
const path = require('path')
const sqlite3 = require('sqlite3').verbose()

const app = express()
const PORT = 3000

app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// DB 연결
const db = new sqlite3.Database('./data/tasks.db')

// 테이블 생성
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
})

// 테스트
app.get('/api/test', (req, res) => {
    res.json({ message: "server working" })
})


// 회원가입
app.post('/api/register', (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).send("입력값 부족")
    }

    db.run(
        'INSERT INTO users (username, password) VALUES (?, ?)',
        [username, password],
        function(err) {
            if (err) return res.status(500).send("이미 존재하는 사용자")
            res.json({ message: '회원가입 완료' })
        }
    )
})


// 로그인
app.post('/api/login', (req, res) => {
    const { username, password } = req.body

    db.get(
        'SELECT * FROM users WHERE username = ? AND password = ?',
        [username, password],
        (err, user) => {
            if (err) return res.status(500).send(err)
            if (!user) return res.status(401).send("로그인 실패")

            res.json({ user })   // 🔥 중요
        }
    )
})


// 할 일 추가
app.post('/api/tasks', (req, res) => {
    const { text, user_id } = req.body

    if (!user_id) {
        return res.status(400).send("user_id 없음")
    }

    if (!text || text.trim() === "") {
        return res.status(400).send("내용 없음")
    }

    db.run(
        'INSERT INTO tasks (text, user_id) VALUES (?, ?)',
        [text, user_id],
        function(err) {
            if (err) {
                console.error(err)
                return res.status(500).send("DB 오류")
            }
            res.json({ id: this.lastID, text })
        }
    )
})


// 할 일 조회 (유저별)
app.get('/api/tasks/:user_id', (req, res) => {
    const user_id = req.params.user_id

    db.all(
        'SELECT * FROM tasks WHERE user_id = ?',
        [user_id],
        (err, rows) => {
            if (err) return res.status(500).send(err)
            res.json(rows)
        }
    )
})


// 완료 토글
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


// 수정
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


// 삭제
app.delete('/api/tasks/:id', (req, res) => {
    const id = req.params.id

    db.run(
        'DELETE FROM tasks WHERE id = ?',
        [id],
        function(err) {
            if (err) return res.status(500).send(err)
            res.json({ message: 'deleted' })
        }
    )
})


// 집중 시간 저장 + 로그
app.put('/api/tasks/focus/:id', (req, res) => {
    const task_id = req.params.id
    const { time, user_id } = req.body

    if (!user_id || !time) {
        return res.status(400).send("데이터 부족")
    }

    const today = new Date().toISOString().slice(0, 10)

    db.run(
        'INSERT INTO focus_logs (user_id, task_id, time, date) VALUES (?, ?, ?, ?)',
        [user_id, task_id, time, today],
        function(err) {
            if (err) return res.status(500).send(err)

            db.run(
                'UPDATE tasks SET focus_time = focus_time + ? WHERE id = ?',
                [time, task_id]
            )

            res.json({ message: 'focus saved' })
        }
    )
})


// 오늘 집중시간
app.get('/api/focus/today/:user_id', (req, res) => {
    const user_id = req.params.user_id
    const today = new Date().toISOString().slice(0, 10)

    db.get(
        'SELECT SUM(time) as total FROM focus_logs WHERE user_id = ? AND date = ?',
        [user_id, today],
        (err, row) => {
            if (err) return res.status(500).send(err)
            res.json({ total: row.total || 0 })
        }
    )
})


// 서버 실행
app.listen(PORT, () => {
    console.log('Server running on port ' + PORT)
})

