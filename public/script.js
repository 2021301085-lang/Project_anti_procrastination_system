let timer = null
let seconds = 0

async function loadTasks(filter = 'all') {
    const res = await fetch('/api/tasks')
    const tasks = await res.json()

    const list = document.getElementById('taskList')
    list.innerHTML = ''

    let filtered = tasks

    if (filter === 'active') {
        filtered = tasks.filter(t => !t.completed)
    } else if (filter === 'completed') {
        filtered = tasks.filter(t => t.completed)
    }

    filtered.forEach(task => {
        const li = document.createElement('li')

        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} 
            onclick="toggleTask(${task.id})">
            ${task.text}
            (집중시간: ${task.focus_time || 0}초)
            <button onclick="deleteTask(${task.id})">삭제</button>
            <button onclick="editTask(${task.id}, '${task.text}')">수정</button>
        `

        list.appendChild(li)
    })

    updateStats(tasks)
    updateTaskSelect(tasks)
}

async function addTask() {
    const input = document.getElementById('taskInput')

    await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.value })
    })

    input.value = ''
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

async function editTask(id, oldText) {
    const newText = prompt("수정할 내용", oldText)
    if (!newText) return

    await fetch('/api/tasks/edit/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText })
    })

    loadTasks()
}

function updateStats(tasks) {
    const total = tasks.length
    const completed = tasks.filter(t => t.completed).length
    const percent = total ? Math.round((completed / total) * 100) : 0

    const totalFocus = tasks.reduce((sum, t) => sum + (t.focus_time || 0), 0)

    document.getElementById('stats').innerText =
        `총 ${total}개 / 완료 ${completed}개 (${percent}%) / 총 집중시간 ${totalFocus}초`
}

function updateTaskSelect(tasks) {
    const select = document.getElementById('taskSelect')
    select.innerHTML = ''

    tasks.forEach(task => {
        const option = document.createElement('option')
        option.value = task.id
        option.text = task.text
        select.appendChild(option)
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
        body: JSON.stringify({ time: seconds })
    })

    seconds = 0
    document.getElementById('timer').innerText = '0초'

    loadTasks()
}

async function addManualTime() {
    const input = document.getElementById('manualTime')
    const time = parseInt(input.value)

    if (!time) return

    const taskId = document.getElementById('taskSelect').value

    await fetch('/api/tasks/focus/' + taskId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time })
    })

    input.value = ''
    loadTasks()
}

async function test() {
    const res = await fetch('/api/test')
    const data = await res.json()
    document.getElementById('result').innerText = data.message
}

loadTasks()
