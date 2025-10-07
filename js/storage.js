const Storage = {
    saveTasks: (tasks) => {
        try {
            localStorage.setItem('kanban_tasks', JSON.stringify(tasks));
            return true;
        } catch (error) {
            console.error('Error saving tasks to local storage:', error);
            return false;
        }
    },

    loadTasks: () => {
        try {
            const tasks = localStorage.getItem('kanban_tasks');
            return tasks ? JSON.parse(tasks) : [];
        } catch (error) {
            console.error('Error loading tasks from local storage:', error);
            return [];
        }
    },

    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    getTasksByStatus: (status) => {
        const tasks = Storage.loadTasks();
        return tasks.filter(task => task.status === status);
    },

    addTask: (task) => {
        const tasks = Storage.loadTasks();
        const now = new Date().toISOString();
        const newTask = {
            id: task.id || Storage.generateId(),
            ...task,
            createdAt: now,
            updatedAt: now,
            activity: task.activity || []
        };
        tasks.push(newTask);
        Storage.saveTasks(tasks);
        return newTask;
    },

    updateTask: (id, updates) => {
        const tasks = Storage.loadTasks();
        const taskIndex = tasks.findIndex(task => task.id === id);
        
        if (taskIndex === -1) return null;
        
        const updatedTask = {
            ...tasks[taskIndex],
            ...updates,
            updatedAt: new Date().toISOString(),
            activity: updates.activity || tasks[taskIndex].activity || []
        };
        
        tasks[taskIndex] = updatedTask;
        Storage.saveTasks(tasks);
        return updatedTask;
    },

    deleteTask: (id) => {
        const tasks = Storage.loadTasks();
        const updatedTasks = tasks.filter(task => task.id !== id);
        return Storage.saveTasks(updatedTasks);
    },

    moveTask: (taskId, newStatus) => {
        return Storage.updateTask(taskId, { status: newStatus });
    },

    addActivity: (taskId, eventType, details, comment = null) => {
        const tasks = Storage.loadTasks();
        const task = tasks.find(t => t.id === taskId);
        
        if (!task) return null;
        
        const activityEntry = {
            timestamp: new Date().toISOString(),
            eventType: eventType, 
            details: details, 
            comment: comment,
            taskTitle: task.title 
        };
        
        const activity = task.activity || [];
        activity.unshift(activityEntry); 
        
        return Storage.updateTask(taskId, { activity });
    },

    getTaskById: (taskId) => {
        const tasks = Storage.loadTasks();
        return tasks.find(t => t.id === taskId);
    },

    getAllActivities: () => {
        const tasks = Storage.loadTasks();
        const allActivities = [];
        
        tasks.forEach(task => {
            if (task.activity && task.activity.length > 0) {
                task.activity.forEach(entry => {
                    allActivities.push({
                        ...entry,
                        taskId: task.id,
                        taskTitle: task.title
                    });
                });
            }
        });
        
        allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return allActivities;
    },

    detectChanges: (oldTask, newTask) => {
        const changes = [];
        const fieldLabels = {
            title: 'Título',
            details: 'Descripción',
            startDate: 'Fecha de inicio',
            endDate: 'Fecha de término',
            department: 'Área',
            category: 'Categoría',
            status: 'Estado'
        };
        
        Object.keys(fieldLabels).forEach(field => {
            if (oldTask[field] !== newTask[field]) {
                changes.push({
                    field: fieldLabels[field],
                    fieldKey: field,
                    oldValue: oldTask[field] || '(vacío)',
                    newValue: newTask[field] || '(vacío)'
                });
            }
        });
        
        return changes;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
