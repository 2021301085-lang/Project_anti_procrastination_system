async function loadTasks() {
    const res = await fetch('/api/tasks')
    const tasks = await res.json()

    const list = document.getElementById('taskList')
    list.innerHTML = ''

    tasks.forEach(task => {
        const li = document.createElement('li')

        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} 
            onclick="toggleTask(${task.id})">
            ${task.text}
        `

        list.appendChild(li)
    })
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

async function test() {
    const res = await fetch('/api/test')
    const data = await res.json()
    document.getElementById('result').innerText = data.message
}

loadTasks()
