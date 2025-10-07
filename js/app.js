document.addEventListener('DOMContentLoaded', init);

const board = document.getElementById('board');
const taskForm = document.getElementById('taskForm');
const taskModal = document.getElementById('taskModal');
const closeModal = document.querySelector('.close-btn');
const cancelBtn = document.getElementById('cancelBtn');
const deleteBtn = document.getElementById('deleteBtn');
const categoryFilter = document.getElementById('categoryFilter');

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
            Storage.moveTask(taskId, newStatus);
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
        }
    } else {
        modalTitle.textContent = 'Añadir Nueva Tarea';
        deleteBtn.classList.add('hidden');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('endDate').valueAsDate = tomorrow;
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

    if (isEdit) {
        Storage.updateTask(taskId, taskPayload);
    } else {
        taskPayload.id = taskId;
        Storage.addTask(taskPayload);
    }
    
    taskModal.style.display = 'none';
    loadTasks();
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