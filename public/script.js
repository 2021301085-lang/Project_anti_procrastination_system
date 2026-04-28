let currentUser = null
let timer = null
let seconds = 0
let chart = null

async function register() {
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })

    document.getElementById('loginStatus').innerText = await res.text()
}

async function login() {
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })

    if (res.ok) {
        const data = await res.json()
        currentUser = data.user
        document.getElementById('loginStatus').innerText = "로그인 성공"
        loadTasks()
        loadTodayFocus()
    }
}

async function loadTasks() {
    if (!currentUser) return

    const res = await fetch('/api/tasks/' + currentUser.id)
    const tasks = await res.json()

    const list = document.getElementById('taskList')
    list.innerHTML = ''

    tasks.forEach(t => {
        const li = document.createElement('li')
        li.innerHTML = `
        <input type="checkbox" ${t.completed ? 'checked' : ''} onclick="toggleTask(${t.id})">
        ${t.text} (${t.focus_time}초)
        <button onclick="deleteTask(${t.id})">삭제</button>
        `
        list.appendChild(li)
    })

    updateStats(tasks)
    updateSelect(tasks)
    drawChart(tasks)
}

async function addTask() {
    if (!currentUser || !currentUser.id) {
        alert("로그인 제대로 안 됨")
        return
    }

    const text = document.getElementById('taskInput').value

    if (!text) {
        alert("할 일을 입력하세요")
        return
    }

    const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            text: text,
            user_id: currentUser.id
        })
    })

    if (!res.ok) {
        alert("추가 실패")
        return
    }

    document.getElementById('taskInput').value = ''
    loadTasks()
}

async function toggleTask(id) {
    await fetch('/api/tasks/' + id, { method: 'PUT' })
    loadTasks()
}

async function deleteTask(id) {
    await fetch('/api/tasks/' + id, { method: 'DELETE' })
    loadTasks()
}

function updateStats(tasks) {
    const total = tasks.length
    const done = tasks.filter(t => t.completed).length

    document.getElementById('stats').innerText =
        `총 ${total} / 완료 ${done}`
}

function updateSelect(tasks) {
    const select = document.getElementById('taskSelect')
    select.innerHTML = ''

    tasks.forEach(t => {
        const op = document.createElement('option')
        op.value = t.id
        op.text = t.text
        select.appendChild(op)
    })
}

function startTimer() {
    if (timer) return

    timer = setInterval(() => {
        seconds++
        document.getElementById('timer').innerText = seconds + '초'
    }, 1000)
}

async function stopTimer() {
    clearInterval(timer)
    timer = null

    const taskId = document.getElementById('taskSelect').value

    await fetch('/api/tasks/focus/' + taskId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            time: seconds,
            user_id: currentUser.id
        })
    })

    seconds = 0
    document.getElementById('timer').innerText = '0초'

    loadTasks()
    loadTodayFocus()
}

async function addManualTime() {
    const time = parseInt(document.getElementById('manualTime').value)
    const taskId = document.getElementById('taskSelect').value

    await fetch('/api/tasks/focus/' + taskId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            time,
            user_id: currentUser.id
        })
    })

    loadTasks()
    loadTodayFocus()
}

async function loadTodayFocus() {
    const res = await fetch('/api/focus/today/' + currentUser.id)
    const data = await res.json()

    document.getElementById('stats').innerText +=
        ` / 오늘 ${data.total}초`
}

function drawChart(tasks) {
    const ctx = document.getElementById('chart').getContext('2d')

    if (chart) chart.destroy()

    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: tasks.map(t => t.text),
            datasets: [{
                data: tasks.map(t => t.focus_time)
            }]
        }
    })
}
