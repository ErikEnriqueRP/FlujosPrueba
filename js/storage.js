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
        const newTask = {
            id: Storage.generateId(),
            ...task,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
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
            updatedAt: new Date().toISOString()
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
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
