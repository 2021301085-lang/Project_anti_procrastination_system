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
            <button onclick="deleteTask(${task.id})">삭제</button>
            <button onclick="editTask(${task.id}, '${task.text}')">수정</button>
        `

        list.appendChild(li)
    })

    updateStats(tasks)
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
    await fetch('/api/tasks/' + id, {
        method: 'PUT'
    })
    loadTasks()
}

async function deleteTask(id) {
    await fetch('/api/tasks/' + id, {
        method: 'DELETE'
    })
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

    document.getElementById('stats').innerText =
        `총 ${total}개 / 완료 ${completed}개 (${percent}%)`
}

async function test() {
    const res = await fetch('/api/test')
    const data = await res.json()
    document.getElementById('result').innerText = data.message
}

loadTasks()
