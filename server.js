const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Путь к папке с проектами
const PROJECTS_DIR = path.join(__dirname, 'projects');

// Создаем папку projects, если её нет
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    console.log('📁 Создана папка для проектов:', PROJECTS_DIR);
}

// Логирование всех запросов
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Корневой маршрут для проверки
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Сервер калькулятора прибыли работает',
        projectsDir: PROJECTS_DIR,
        time: new Date().toISOString()
    });
});

// Проверка соединения
app.get('/api/ping', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Сервер доступен',
        timestamp: new Date().toISOString()
    });
});

// Получить список всех проектов
app.get('/api/projects', (req, res) => {
    try {
        console.log('📂 Запрос списка проектов');
        
        if (!fs.existsSync(PROJECTS_DIR)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(PROJECTS_DIR);
        console.log(`📄 Найдено файлов: ${files.length}`);
        
        const projects = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                try {
                    const filePath = path.join(PROJECTS_DIR, file);
                    const stats = fs.statSync(filePath);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const projectData = JSON.parse(content);
                    
                    return {
                        id: projectData.id || file.replace('.json', ''),
                        name: projectData.name || 'Без названия',
                        description: projectData.description || '',
                        lastModified: stats.mtime,
                        createdAt: stats.birthtime,
                        fileSize: stats.size,
                        users: projectData.users || [],
                        transactions: projectData.transactions || []
                    };
                } catch (e) {
                    console.error(`❌ Ошибка чтения файла ${file}:`, e.message);
                    return null;
                }
            })
            .filter(p => p !== null)
            .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        
        console.log(`✅ Отправлено проектов: ${projects.length}`);
        res.json(projects);
    } catch (error) {
        console.error('❌ Ошибка получения списка проектов:', error);
        res.status(500).json({ error: error.message });
    }
});

// Сохранить проект
app.post('/api/projects/save', (req, res) => {
    try {
        console.log('💾 Запрос на сохранение проекта');
        
        const { id, name, description, users, transactions } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Название проекта обязательно' });
        }
        
        // Генерируем ID если его нет
        const projectId = id || Date.now().toString();
        const fileName = `${projectId}.json`;
        const filePath = path.join(PROJECTS_DIR, fileName);
        
        // Данные для сохранения
        const projectData = {
            id: projectId,
            name: name,
            description: description || '',
            lastModified: new Date().toISOString(),
            users: users || [],
            transactions: transactions || []
        };
        
        // Сохраняем в файл
        fs.writeFileSync(filePath, JSON.stringify(projectData, null, 2));
        
        console.log(`✅ Проект сохранен: ${fileName}`);
        
        res.json({ 
            success: true, 
            id: projectId,
            message: 'Проект успешно сохранен',
            path: filePath
        });
    } catch (error) {
        console.error('❌ Ошибка сохранения проекта:', error);
        res.status(500).json({ error: error.message });
    }
});

// Загрузить проект
app.get('/api/projects/load/:id', (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`📥 Запрос на загрузку проекта: ${projectId}`);
        
        // Ищем файл с таким ID
        const files = fs.readdirSync(PROJECTS_DIR);
        const projectFile = files.find(f => f.startsWith(projectId) && f.endsWith('.json'));
        
        if (!projectFile) {
            // Пробуем найти по имени файла без расширения
            const exactFile = `${projectId}.json`;
            if (files.includes(exactFile)) {
                const filePath = path.join(PROJECTS_DIR, exactFile);
                const projectData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log(`✅ Проект загружен: ${exactFile}`);
                return res.json(projectData);
            }
            
            console.log(`❌ Проект не найден: ${projectId}`);
            return res.status(404).json({ error: 'Проект не найден' });
        }
        
        const filePath = path.join(PROJECTS_DIR, projectFile);
        const projectData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        console.log(`✅ Проект загружен: ${projectFile}`);
        res.json(projectData);
    } catch (error) {
        console.error('❌ Ошибка загрузки проекта:', error);
        res.status(500).json({ error: error.message });
    }
});

// Удалить проект
app.delete('/api/projects/delete/:id', (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`🗑️ Запрос на удаление проекта: ${projectId}`);
        
        const fileName = `${projectId}.json`;
        const filePath = path.join(PROJECTS_DIR, fileName);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ Проект удален: ${fileName}`);
            res.json({ success: true, message: 'Проект удален' });
        } else {
            console.log(`❌ Файл не найден: ${fileName}`);
            res.status(404).json({ error: 'Проект не найден' });
        }
    } catch (error) {
        console.error('❌ Ошибка удаления проекта:', error);
        res.status(500).json({ error: error.message });
    }
});

// Экспортировать проект в JSON
app.get('/api/projects/export/:id', (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`⬇️ Запрос на экспорт проекта: ${projectId}`);
        
        const fileName = `${projectId}.json`;
        const filePath = path.join(PROJECTS_DIR, fileName);
        
        if (!fs.existsSync(filePath)) {
            console.log(`❌ Файл не найден: ${fileName}`);
            return res.status(404).json({ error: 'Проект не найден' });
        }
        
        res.download(filePath, `project_${projectId}.json`);
        console.log(`✅ Файл отправлен на скачивание: ${fileName}`);
    } catch (error) {
        console.error('❌ Ошибка экспорта проекта:', error);
        res.status(500).json({ error: error.message });
    }
});

// Получить статистику
app.get('/api/projects/stats', (req, res) => {
    try {
        console.log('📊 Запрос статистики');
        
        const files = fs.readdirSync(PROJECTS_DIR);
        const stats = {
            totalProjects: 0,
            totalSize: 0,
            lastProject: null,
            projects: []
        };
        
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const filePath = path.join(PROJECTS_DIR, file);
                const stat = fs.statSync(filePath);
                stats.totalProjects++;
                stats.totalSize += stat.size;
                
                stats.projects.push({
                    name: file,
                    size: stat.size,
                    modified: stat.mtime
                });
                
                if (!stats.lastProject || stat.mtime > stats.lastProject.modified) {
                    stats.lastProject = {
                        name: file,
                        modified: stat.mtime
                    };
                }
            }
        });
        
        stats.totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
        
        console.log(`✅ Статистика: ${stats.totalProjects} проектов, ${stats.totalSizeMB} MB`);
        res.json(stats);
    } catch (error) {
        console.error('❌ Ошибка получения статистики:', error);
        res.status(500).json({ error: error.message });
    }
});

// Обработка ошибок 404
app.use((req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 ==================================');
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📁 Проекты сохраняются в: ${PROJECTS_DIR}`);
    console.log(`🌐 Доступен по сети: http://${require('os').hostname()}:${PORT}`);
    console.log('🚀 ==================================\n');

});


