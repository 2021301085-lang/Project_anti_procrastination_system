let currentUser = null
let timer = null
let seconds = 0
let taskChart = null
let weeklyChart = null
let currentFilter = 'all'
let todayFocus = 0
let todayGoal = 0
let streak = 0
let allTasks = []

let pomodoroTimer = null
let pomodoroSeconds = 1500
let pomodoroRunningSeconds = 0

window.onload = () => {
    const savedUser = localStorage.getItem('currentUser')

    if (savedUser) {
        currentUser = JSON.parse(savedUser)
        document.getElementById('loginStatus').innerText = currentUser.username + ' 로그인 중'
        loadDashboard()
    }

    updatePomodoroText()
}

async function testServer() {
    const res = await fetch('/api/test')
    const data = await res.json()
    document.getElementById('result').innerText = data.message
}

async function register() {
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })

    if (res.ok) {
        const data = await res.json()
        document.getElementById('loginStatus').innerText = data.message
    } else {
        document.getElementById('loginStatus').innerText = await res.text()
    }
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
        localStorage.setItem('currentUser', JSON.stringify(currentUser))
        document.getElementById('loginStatus').innerText = currentUser.username + ' 로그인 중'
        await loadDashboard()
    } else {
        document.getElementById('loginStatus').innerText = await res.text()
    }
}

function logout() {
    currentUser = null
    localStorage.removeItem('currentUser')
    document.getElementById('loginStatus').innerText = '로그인이 필요합니다.'
    document.getElementById('dashboard').innerText = '로그인 후 대시보드가 표시됩니다.'
    document.getElementById('recommendTask').innerText = '추천 할 일이 없습니다.'
    document.getElementById('taskList').innerHTML = ''
    document.getElementById('taskSelect').innerHTML = ''
    document.getElementById('pomodoroTaskSelect').innerHTML = ''
    document.getElementById('stats').innerText = '로그인 후 통계가 표시됩니다.'
    document.getElementById('goalStatus').innerText = '목표 없음'

    if (taskChart) taskChart.destroy()
    if (weeklyChart) weeklyChart.destroy()
}

async function loadDashboard() {
    await loadTasks(currentFilter)
    await loadWeeklyFocus()
    await loadStreak()
    await loadRecommendTask()
    await loadFocusHistory()
    await loadWeeklyReport()
    updateDashboard()
}

async function loadTasks(filter = 'all') {
    if (!currentUser) {
        alert('로그인 먼저 하세요')
        return
    }

    currentFilter = filter

    const taskRes = await fetch('/api/tasks/' + currentUser.id)
    allTasks = await taskRes.json()

    const todayRes = await fetch('/api/focus/today/' + currentUser.id)
    const todayData = await todayRes.json()
    todayFocus = todayData.total || 0

    const goalRes = await fetch('/api/goal/today/' + currentUser.id)
    const goalData = await goalRes.json()
    todayGoal = goalData.goal_time || 0

    let filtered = allTasks

    if (filter === 'active') {
        filtered = allTasks.filter(task => !task.completed)
    }

    if (filter === 'completed') {
        filtered = allTasks.filter(task => task.completed)
    }

    renderTasks(filtered)
    updateTaskSelect(allTasks)
    updateStats(allTasks)
    updateGoalStatus()
    drawTaskChart(allTasks)
}

function renderTasks(tasks) {
    const list = document.getElementById('taskList')
    list.innerHTML = ''

    tasks.forEach(task => {
        const li = document.createElement('li')
        const checkbox = document.createElement('input')
        const textSpan = document.createElement('span')
        const editButton = document.createElement('button')
        const deleteButton = document.createElement('button')

        checkbox.type = 'checkbox'
        checkbox.checked = task.completed === 1
        checkbox.onclick = () => toggleTask(task.id)

        textSpan.innerText =
            ' ' + task.text +
            ' / 카테고리: ' + (task.category || '없음') +
            ' / 우선순위: ' + priorityText(task.priority) +
            ' / 마감일: ' + (task.due_date || '없음') +
            ' / 예상: ' + (task.estimated_time || 0) + '초' +
            ' / 집중: ' + (task.focus_time || 0) + '초 '

        editButton.innerText = '수정'
        editButton.onclick = () => editTask(task)

        deleteButton.innerText = '삭제'
        deleteButton.onclick = () => deleteTask(task.id)

        li.appendChild(checkbox)
        li.appendChild(textSpan)
        li.appendChild(editButton)
        li.appendChild(deleteButton)

        list.appendChild(li)
    })
}

async function addTask() {
    if (!currentUser) {
        alert('로그인 먼저 하세요')
        return
    }

    const text = document.getElementById('taskInput').value.trim()
    const category = document.getElementById('categoryInput').value.trim()
    const dueDate = document.getElementById('dueDateInput').value
    const priority = document.getElementById('priorityInput').value
    const estimatedTime = Number(document.getElementById('estimatedInput').value) || 0

    if (!text) {
        alert('할 일을 입력하세요')
        return
    }

    const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            user_id: currentUser.id,
            category,
            due_date: dueDate,
            priority,
            estimated_time: estimatedTime
        })
    })

    if (!res.ok) {
        alert(await res.text())
        return
    }

    document.getElementById('taskInput').value = ''
    document.getElementById('categoryInput').value = ''
    document.getElementById('dueDateInput').value = ''
    document.getElementById('priorityInput').value = '2'
    document.getElementById('estimatedInput').value = ''

    await loadDashboard()
}

async function toggleTask(id) {
    const res = await fetch('/api/tasks/' + id + '/toggle', {
        method: 'PUT'
    })

    if (!res.ok) {
        alert(await res.text())
        return
    }

    await loadDashboard()
}

async function editTask(task) {
    const text = prompt('할 일 수정', task.text)
    if (!text || text.trim() === '') return

    const category = prompt('카테고리 수정', task.category || '')
    const dueDate = prompt('마감일 수정 예: 2026-05-19', task.due_date || '')
    const priority = prompt('우선순위 수정 1=높음, 2=보통, 3=낮음', task.priority || 2)
    const estimatedTime = prompt('예상 시간 수정(초)', task.estimated_time || 0)

    const res = await fetch('/api/tasks/' + task.id + '/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: text.trim(),
            category: category || '',
            due_date: dueDate || '',
            priority: Number(priority) || 2,
            estimated_time: Number(estimatedTime) || 0
        })
    })

    if (!res.ok) {
        alert(await res.text())
        return
    }

    await loadDashboard()
}

async function deleteTask(id) {
    const ok = confirm('삭제할까요?')

    if (!ok) {
        return
    }

    const res = await fetch('/api/tasks/' + id, {
        method: 'DELETE'
    })

    if (!res.ok) {
        alert(await res.text())
        return
    }

    await loadDashboard()
}

function updateStats(tasks) {
    const total = tasks.length
    const completed = tasks.filter(task => task.completed).length
    const active = total - completed
    const percent = total ? Math.round((completed / total) * 100) : 0
    const totalFocus = tasks.reduce((sum, task) => sum + (task.focus_time || 0), 0)
    const totalEstimated = tasks.reduce((sum, task) => sum + (task.estimated_time || 0), 0)
    const goalPercent = todayGoal ? Math.min(100, Math.round((todayFocus / todayGoal) * 100)) : 0

    document.getElementById('stats').innerText =
        `총 ${total}개 / 미완료 ${active}개 / 완료 ${completed}개 / 완료율 ${percent}% / 예상 집중시간 ${totalEstimated}초 / 전체 집중시간 ${totalFocus}초 / 오늘 집중시간 ${todayFocus}초 / 목표 달성률 ${goalPercent}%`
}

function updateTaskSelect(tasks) {
    const taskSelect = document.getElementById('taskSelect')
    const pomodoroTaskSelect = document.getElementById('pomodoroTaskSelect')

    taskSelect.innerHTML = ''
    pomodoroTaskSelect.innerHTML = ''

    tasks.filter(task => !task.completed).forEach(task => {
        const option1 = document.createElement('option')
        option1.value = task.id
        option1.text = task.text
        taskSelect.appendChild(option1)

        const option2 = document.createElement('option')
        option2.value = task.id
        option2.text = task.text
        pomodoroTaskSelect.appendChild(option2)
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
    if (!timer && seconds === 0) {
        return
    }

    clearInterval(timer)
    timer = null

    const taskId = document.getElementById('taskSelect').value

    if (!taskId) {
        alert('할 일을 먼저 추가하세요')
        resetTimer()
        return
    }

    await saveFocusTime(taskId, seconds)

    seconds = 0
    document.getElementById('timer').innerText = '0초'

    await loadDashboard()
}

function resetTimer() {
    clearInterval(timer)
    timer = null
    seconds = 0
    document.getElementById('timer').innerText = '0초'
}

async function addManualTime() {
    if (!currentUser) {
        alert('로그인 먼저 하세요')
        return
    }

    const input = document.getElementById('manualTime')
    const time = Number(input.value)
    const taskId = document.getElementById('taskSelect').value

    if (!taskId) {
        alert('할 일을 먼저 추가하세요')
        return
    }

    if (!time || time <= 0) {
        alert('시간을 올바르게 입력하세요')
        return
    }

    await saveFocusTime(taskId, time)

    input.value = ''
    await loadDashboard()
}

async function saveFocusTime(taskId, time) {
    const res = await fetch('/api/tasks/focus/' + taskId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            time,
            user_id: currentUser.id
        })
    })

    if (!res.ok) {
        alert(await res.text())
    }
}

async function saveGoal() {
    if (!currentUser) {
        alert('로그인 먼저 하세요')
        return
    }

    const input = document.getElementById('goalInput')
    const goalTime = Number(input.value)

    if (goalTime < 0) {
        alert('목표 시간을 올바르게 입력하세요')
        return
    }

    const res = await fetch('/api/goal/today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentUser.id,
            goal_time: goalTime
        })
    })

    if (!res.ok) {
        alert(await res.text())
        return
    }

    input.value = ''
    await loadDashboard()
}

function updateGoalStatus() {
    const goalPercent = todayGoal ? Math.min(100, Math.round((todayFocus / todayGoal) * 100)) : 0

    if (!todayGoal) {
        document.getElementById('goalStatus').innerText = `오늘 집중시간 ${todayFocus}초 / 목표 없음`
    } else {
        document.getElementById('goalStatus').innerText = `오늘 집중시간 ${todayFocus}초 / 목표 ${todayGoal}초 / 달성률 ${goalPercent}%`
    }
}

async function loadStreak() {
    if (!currentUser) return

    const res = await fetch('/api/streak/' + currentUser.id)
    const data = await res.json()
    streak = data.streak || 0
}

async function loadRecommendTask() {
    if (!currentUser) return

    const res = await fetch('/api/tasks/recommend/' + currentUser.id)
    const data = await res.json()

    if (!data.task) {
        document.getElementById('recommendTask').innerText = '현재 추천할 미완료 할 일이 없습니다.'
        return
    }

    const task = data.task

    document.getElementById('recommendTask').innerText =
        `${task.text} / 우선순위 ${priorityText(task.priority)} / 마감일 ${task.due_date || '없음'} / 예상 ${task.estimated_time || 0}초`
}

function updateDashboard() {
    const goalPercent = todayGoal ? Math.min(100, Math.round((todayFocus / todayGoal) * 100)) : 0

    document.getElementById('dashboard').innerText =
        `오늘 집중시간 ${todayFocus}초 / 목표 달성률 ${goalPercent}% / 연속 집중일 ${streak}일`
}

function startPomodoro() {
    if (!currentUser) {
        alert('로그인 먼저 하세요')
        return
    }

    const taskId = document.getElementById('pomodoroTaskSelect').value

    if (!taskId) {
        alert('할 일을 먼저 추가하세요')
        return
    }

    if (pomodoroTimer) {
        return
    }

    if (pomodoroSeconds <= 0) {
        pomodoroSeconds = Number(document.getElementById('pomodoroMode').value)
    }

    pomodoroTimer = setInterval(async () => {
        pomodoroSeconds--
        pomodoroRunningSeconds++
        updatePomodoroText()

        if (pomodoroSeconds <= 0) {
            clearInterval(pomodoroTimer)
            pomodoroTimer = null

            const mode = Number(document.getElementById('pomodoroMode').value)

            if (mode === 1500) {
                await saveFocusTime(taskId, pomodoroRunningSeconds)
                await loadDashboard()
                alert('25분 집중 완료! 집중 시간이 저장되었습니다.')
            } else {
                alert('휴식 시간이 끝났습니다.')
            }

            pomodoroRunningSeconds = 0
            pomodoroSeconds = mode
            updatePomodoroText()
        }
    }, 1000)
}

function pausePomodoro() {
    clearInterval(pomodoroTimer)
    pomodoroTimer = null
}

function resetPomodoro() {
    clearInterval(pomodoroTimer)
    pomodoroTimer = null
    pomodoroRunningSeconds = 0
    pomodoroSeconds = Number(document.getElementById('pomodoroMode').value)
    updatePomodoroText()
}

document.getElementById('pomodoroMode').addEventListener('change', () => {
    resetPomodoro()
})

function updatePomodoroText() {
    const minute = Math.floor(pomodoroSeconds / 60)
    const second = pomodoroSeconds % 60

    document.getElementById('pomodoroTimer').innerText =
        String(minute).padStart(2, '0') + ':' + String(second).padStart(2, '0')
}

function drawTaskChart(tasks) {
    const ctx = document.getElementById('taskChart').getContext('2d')

    if (taskChart) {
        taskChart.destroy()
    }

    taskChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: tasks.map(task => task.text),
            datasets: [{
                label: '할 일별 집중 시간',
                data: tasks.map(task => task.focus_time || 0)
            }]
        }
    })
}

async function loadWeeklyFocus() {
    if (!currentUser) return

    const res = await fetch('/api/focus/weekly/' + currentUser.id)
    const rows = await res.json()

    drawWeeklyChart(rows)
}

function drawWeeklyChart(rows) {
    const ctx = document.getElementById('weeklyChart').getContext('2d')

    if (weeklyChart) {
        weeklyChart.destroy()
    }

    weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: rows.map(row => row.date),
            datasets: [{
                label: '최근 7일 집중 시간',
                data: rows.map(row => row.total || 0)
            }]
        }
    })
}

function priorityText(priority) {
    const value = Number(priority)

    if (value === 1) {
        return '높음'
    }

    if (value === 3) {
        return '낮음'
    }

    return '보통'
}

async function loadFocusHistory() {
    if (!currentUser) return

    const res = await fetch('/api/focus/history/' + currentUser.id)
    const rows = await res.json()

    const list = document.getElementById('focusHistory')
    list.innerHTML = ''

    if (rows.length === 0) {
        list.innerHTML =
            '<li>집중 기록이 없습니다.</li>'
        return
    }

    rows.forEach(row => {
        const li = document.createElement('li')

        li.innerText =
            `${row.date}
            / ${row.task_name || '이름 없음'}
            / ${row.time}초`

        list.appendChild(li)
    })
}

async function loadWeeklyReport() {
    if (!currentUser) return

    const res = await fetch('/api/report/weekly/' + currentUser.id)
    const report = await res.json()

    document.getElementById('weeklyReport').innerText =
        `최근 7일 총 집중시간: ${report.totalFocus}초
평균 집중시간: ${report.averageFocus}초
가장 집중한 날: ${report.bestDay}
가장 많이 집중한 할 일: ${report.bestTask}`
}
