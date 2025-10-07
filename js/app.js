document.addEventListener('DOMContentLoaded', init);

const board = document.getElementById('board');
const taskForm = document.getElementById('taskForm');
const taskModal = document.getElementById('taskModal');
const closeModal = document.querySelector('.close-btn');
const cancelBtn = document.getElementById('cancelBtn');
const deleteBtn = document.getElementById('deleteBtn');
const categoryFilter = document.getElementById('categoryFilter');
const globalFeedView = document.getElementById('globalFeedView');
const kanbanView = document.getElementById('kanbanView');

let currentView = 'kanban';

const columns = [
    { id: 'backlog', title: 'Tareas / Por Hacer' },
    { id: 'inProgress', title: 'En Progreso' },
    { id: 'error', title: 'Error / Bloqueado' },
    { id: 'completed', title: 'Completado' },
    { id: 'na', title: 'No Aplica' }
];

const categories = [
    { id: 'bug', name: 'Bug', class: 'bug' },
    { id: 'feature', name: 'New Feature', class: 'feature' },
    { id: 'design', name: 'Design', class: 'design' },
    { id: 'documentation', name: 'Documentation', class: 'documentation' }
];

function init() {
    renderBoard();
    loadTasks();
    setupEventListeners();
}

function renderBoard() {
    board.innerHTML = '';
    columns.forEach(column => {
        const columnElement = document.createElement('div');
        columnElement.className = 'column';
        columnElement.dataset.columnId = column.id;
        columnElement.innerHTML = `
            <div class="column-header">
                <span>${column.title}</span>
                <span class="task-count" id="${column.id}-count">0</span>
            </div>
            <div class="tasks-container" data-column="${column.id}" id="${column.id}-tasks">
                ${column.id === 'backlog' ? `
                    <button class="add-task-btn" data-column="${column.id}">
                        <i class="fas fa-plus"></i> Añadir Tarea
                    </button>
                ` : ''}
            </div>
        `;
        board.appendChild(columnElement);
    });
    setupDragAndDrop();
}

function setupEventListeners() {
    if (closeModal) {
        closeModal.addEventListener('click', () => taskModal.style.display = 'none');
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => taskModal.style.display = 'none');
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteTask);
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === taskModal) {
            taskModal.style.display = 'none';
        }
    });
    
    taskForm.addEventListener('submit', handleTaskSubmit);
    categoryFilter.addEventListener('change', filterTasksByCategory);
    
    document.addEventListener('click', (e) => {
        if (e.target.closest('.add-task-btn')) {
            const columnId = e.target.closest('.add-task-btn').dataset.column;
            openTaskModal(columnId);
        }
        if (e.target.closest('.task-card')) {
            const taskId = e.target.closest('.task-card').dataset.taskId;
            openTaskModal(undefined, taskId);
        }
    });
}

function setupDragAndDrop() {
    const containers = document.querySelectorAll('.tasks-container');

    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('task-card')) {
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('task-card')) {
            e.target.classList.remove('dragging');
        }
    });

    containers.forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                const afterElement = getDragAfterElement(container, e.clientY);
                const addBtn = container.querySelector('.add-task-btn');
                if (afterElement) {
                    container.insertBefore(draggable, afterElement);
                } else if (addBtn) {
                    container.insertBefore(draggable, addBtn);
                } else {
                    container.appendChild(draggable);
                }
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = container.dataset.column;
            
            const task = Storage.getTaskById(taskId);
            const oldStatus = task ? task.status : '';
            const oldColumnName = columns.find(c => c.id === oldStatus)?.title || oldStatus;
            const newColumnName = columns.find(c => c.id === newStatus)?.title || newStatus;
            
            Storage.moveTask(taskId, newStatus);
            if (oldStatus !== newStatus) {
                const moveDetails = {
                    field: 'Estado',
                    oldValue: oldColumnName,
                    newValue: newColumnName
                };
                Storage.addActivity(taskId, 'MOVE', [moveDetails]);
            }
            
            loadTasks();
        });
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

function openTaskModal(columnId = 'backlog', taskId = '') {
    taskForm.reset();
    taskForm.dataset.columnId = columnId || 'backlog';
    taskForm.dataset.taskId = taskId;

    const modalTitle = document.getElementById('modalTitle');

    if (taskId) {
        modalTitle.textContent = 'Editar Tarea';
        deleteBtn.classList.remove('hidden');
        const tasks = Storage.loadTasks();
        const existing = tasks.find(t => t.id === taskId);
        if (existing) {
            document.getElementById('taskTitle').value = existing.title || '';
            document.getElementById('taskDetails').value = existing.details || '';
            document.getElementById('startDate').value = existing.startDate || '';
            document.getElementById('endDate').value = existing.endDate || '';
            document.getElementById('department').value = existing.department || '';
            document.getElementById('category').value = existing.category || '';
            taskForm.dataset.columnId = existing.status || 'backlog';

            taskForm.dataset.hasActivity = (existing.activity && existing.activity.length > 0) ? 'true' : 'false';
        }
    } else {
        modalTitle.textContent = 'Añadir Nueva Tarea';
        deleteBtn.classList.add('hidden');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('endDate').valueAsDate = tomorrow;
        
        taskForm.dataset.hasActivity = 'false';
    }

    taskModal.style.display = 'flex';
}

function handleTaskSubmit(e) {
    e.preventDefault();
    
    const isEdit = !!taskForm.dataset.taskId;
    const taskId = isEdit ? taskForm.dataset.taskId : Storage.generateId();
    const columnId = taskForm.dataset.columnId || 'backlog';

    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
        alert('El título es obligatorio');
        return;
    }

    const taskPayload = {
        title: title,
        details: document.getElementById('taskDetails').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        department: document.getElementById('department').value,
        category: document.getElementById('category').value,
        status: columnId
    };

    const commentInput = document.getElementById('updateComment');
    const comment = commentInput ? commentInput.value.trim() : null;

    if (isEdit) {
        const oldTask = Storage.getTaskById(taskId);
        const changes = Storage.detectChanges(oldTask, taskPayload);
        
        Storage.updateTask(taskId, taskPayload);
        
        if (changes.length > 0) {
            Storage.addActivity(taskId, 'UPDATE', changes, comment || null);
        }
    } else {
        taskPayload.id = taskId;
        const columnName = columns.find(c => c.id === columnId)?.title || columnId;
        taskPayload.activity = [{
            timestamp: new Date().toISOString(),
            eventType: 'CREATE',
            details: [{ field: 'Estado inicial', newValue: columnName }],
            comment: comment || null,
            taskTitle: title
        }];
        Storage.addTask(taskPayload);
    }
    
    if (commentInput) commentInput.value = '';
    
    taskModal.style.display = 'none';
    loadTasks();
    if (currentView === 'global') renderGlobalFeed();
}

function handleDeleteTask() {
    const taskId = taskForm.dataset.taskId;
    if (!taskId) return;

    const isConfirmed = confirm('¿Estás seguro de que quieres eliminar esta tarea? Esta acción no se puede deshacer.');
    
    if (isConfirmed) {
        Storage.deleteTask(taskId);
        taskModal.style.display = 'none';
        loadTasks();
    }
}

function loadTasks() {
    const tasksArray = Storage.loadTasks();
    
    document.querySelectorAll('.tasks-container').forEach(container => {
        const addButton = container.querySelector('.add-task-btn');
        container.innerHTML = '';
        if (addButton) {
            container.appendChild(addButton);
        }
    });
    
    tasksArray.forEach(task => {
        const container = document.querySelector(`#${task.status}-tasks`);
        if (container) {
            const taskElement = createTaskElement(task);
            const addButton = container.querySelector('.add-task-btn');
            if (addButton) {
                container.insertBefore(taskElement, addButton);
            } else {
                container.appendChild(taskElement);
            }
        }
    });
    
    updateTaskCounts();
    filterTasksByCategory();
}

function createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-card';
    taskElement.draggable = true;
    taskElement.dataset.taskId = task.id;
    
    const category = categories.find(cat => cat.id === task.category) || {};
    const dueDate = task.endDate ? new Date(task.endDate + 'T00:00:00-06:00').toLocaleDateString() : 'Sin fecha';
    
    taskElement.innerHTML = `
        <div class="task-title">${task.title}</div>
        <span class="category-tag ${category.class || ''}">${category.name || 'General'}</span>
        <div class="task-meta">
            <span>${task.department || 'Sin Área'}</span>
            <span><i class="fas fa-calendar-alt"></i> ${dueDate}</span>
        </div>
    `;
    
    return taskElement;
}

function updateTaskCounts() {
    const tasksArray = Storage.loadTasks();
    columns.forEach(column => {
        const count = tasksArray.filter(task => task.status === column.id).length;
        const countElement = document.getElementById(`${column.id}-count`);
        if (countElement) {
            countElement.textContent = count;
        }
    });
}

function filterTasksByCategory() {
    const selectedCategory = categoryFilter.value;
    const tasksArray = Storage.loadTasks();

    tasksArray.forEach(task => {
        const taskElement = document.querySelector(`.task-card[data-task-id="${task.id}"]`);
        if (taskElement) {
            if (selectedCategory === 'all' || task.category === selectedCategory) {
                taskElement.style.display = 'block';
            } else {
                taskElement.style.display = 'none';
            }
        }
    });
}

function toggleActivityLog() {
    const activitySection = document.querySelector('.activity-section');
    const toggleBtn = document.getElementById('toggleHistoryBtn');
    const taskId = taskForm.dataset.taskId;
    
    if (!activitySection || !toggleBtn) return;
    
    const isVisible = !activitySection.classList.contains('hidden-by-default');
    
    if (isVisible) {
        activitySection.classList.add('hidden-by-default');
        toggleBtn.innerHTML = '<i class="fas fa-history"></i> Ver Historial';
    } else {
        activitySection.classList.remove('hidden-by-default');
        toggleBtn.innerHTML = '<i class="fas fa-history"></i> Ocultar Historial';
        
        if (taskId) {
            const task = Storage.getTaskById(taskId);
            displayActivityLog(task ? task.activity || [] : []);
        } else {
            displayActivityLog([]);
        }
    }
}

function displayActivityLog(activityArray) {
    const activityContainer = document.getElementById('activityLog');
    if (!activityContainer) return;
    
    if (!activityArray || activityArray.length === 0) {
        activityContainer.innerHTML = '<p class="no-activity">No hay actividad registrada aún.</p>';
        return;
    }
    
    const activityHTML = activityArray.map(entry => {
        const timestamp = formatTimestamp(entry.timestamp);
        let description = generateActivityDescription(entry);
        
        return `
            <div class="activity-entry">
                <div class="activity-icon"><i class="fas fa-circle"></i></div>
                <div class="activity-content">
                    <div class="activity-description">${description}</div>
                    ${entry.comment ? `<div class="activity-comment"><i class="fas fa-comment"></i> <strong>Comentario:</strong> ${entry.comment}</div>` : ''}
                    <p class="activity-time">${timestamp}</p>
                </div>
            </div>
        `;
    }).join('');
    
    activityContainer.innerHTML = activityHTML;
}

function generateActivityDescription(entry) {
    switch (entry.eventType) {
        case 'CREATE':
            return '<strong>Tarea creada</strong>';
        
        case 'MOVE':
            if (entry.details && entry.details.length > 0) {
                const detail = entry.details[0];
                return `<strong>Tarea movida</strong> de "${detail.oldValue}" a "${detail.newValue}"`;
            }
            return '<strong>Tarea movida</strong>';
        
        case 'UPDATE':
            if (entry.details && entry.details.length > 0) {
                const changesList = entry.details.map(change => 
                    `<li><strong>${change.field}:</strong> "${change.oldValue}" → "${change.newValue}"</li>`
                ).join('');
                return `<strong>Detalles actualizados:</strong><ul class="change-list">${changesList}</ul>`;
            }
            return '<strong>Detalles actualizados</strong>';
        
        default:
            return entry.description || 'Acción realizada';
    }
}

function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    };
    return date.toLocaleDateString('es-MX', options);
}

function switchView(view) {
    currentView = view;
    
    if (view === 'kanban') {
        kanbanView.classList.remove('hidden-by-default');
        globalFeedView.classList.add('hidden-by-default');
        document.getElementById('viewKanbanBtn').classList.add('active');
        document.getElementById('viewGlobalBtn').classList.remove('active');
    } else {
        kanbanView.classList.add('hidden-by-default');
        globalFeedView.classList.remove('hidden-by-default');
        document.getElementById('viewKanbanBtn').classList.remove('active');
        document.getElementById('viewGlobalBtn').classList.add('active');
        renderGlobalFeed();
    }
}

function renderGlobalFeed() {
    const feedContainer = document.getElementById('globalActivityFeed');
    if (!feedContainer) return;
    
    const allActivities = Storage.getAllActivities();
    
    if (allActivities.length === 0) {
        feedContainer.innerHTML = '<div class="no-activity-global"><i class="fas fa-inbox"></i><p>No hay actividad registrada en el proyecto.</p></div>';
        return;
    }
    
    const feedHTML = allActivities.map(entry => {
        const timestamp = formatTimestamp(entry.timestamp);
        const description = generateGlobalFeedDescription(entry);
        
        return `
            <div class="global-feed-entry" data-task-id="${entry.taskId}">
                <div class="feed-timestamp">${timestamp}</div>
                <div class="feed-content">
                    <div class="feed-description">${description}</div>
                    ${entry.comment ? `<div class="feed-comment"><i class="fas fa-comment"></i> ${entry.comment}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    feedContainer.innerHTML = feedHTML;
    
    document.querySelectorAll('.global-feed-entry').forEach(entry => {
        entry.addEventListener('click', () => {
            const taskId = entry.dataset.taskId;
            switchView('kanban');
            setTimeout(() => openTaskModal(undefined, taskId), 100);
        });
    });
}

function generateGlobalFeedDescription(entry) {
    const taskLink = `<strong class="task-link">${entry.taskTitle}</strong>`;
    
    switch (entry.eventType) {
        case 'CREATE':
            return `Se creó la tarea ${taskLink}`;
        
        case 'MOVE':
            if (entry.details && entry.details.length > 0) {
                const detail = entry.details[0];
                return `Se movió ${taskLink} de "${detail.oldValue}" a "${detail.newValue}"`;
            }
            return `Se movió la tarea ${taskLink}`;
        
        case 'UPDATE':
            if (entry.details && entry.details.length > 0) {
                const fieldCount = entry.details.length;
                const fieldNames = entry.details.map(d => d.field).join(', ');
                return `Se actualizó ${taskLink} (${fieldNames})`;
            }
            return `Se actualizó la tarea ${taskLink}`;
        
        default:
            return `Acción en la tarea ${taskLink}`;
    }
}