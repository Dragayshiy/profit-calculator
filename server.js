const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

// Расширенные настройки CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Папка для проектов
const PROJECTS_DIR = path.join(__dirname, 'projects');

// Создаем папку projects если её нет
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    console.log('📁 Создана папка для проектов:', PROJECTS_DIR);
}

// Проверка прав на запись
try {
    fs.accessSync(PROJECTS_DIR, fs.constants.W_OK);
    console.log('✅ Права на запись в projects есть');
} catch (err) {
    console.error('❌ Нет прав на запись в projects:', err.message);
    // Пытаемся исправить права
    fs.chmodSync(PROJECTS_DIR, 0o777);
    console.log('🔧 Права изменены на 777');
}

// Логирование всех запросов
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Проверка соединения
app.get('/api/ping', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Сервер доступен',
        timestamp: new Date().toISOString(),
        projectsDir: PROJECTS_DIR,
        writable: fs.constants.W_OK ? 'checking...' : 'unknown'
    });
});

// Получить список проектов
app.get('/api/projects', (req, res) => {
    try {
        console.log('📂 Запрос списка проектов');
        
        if (!fs.existsSync(PROJECTS_DIR)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(PROJECTS_DIR);
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
                        users: projectData.users || [],
                        transactions: projectData.transactions || []
                    };
                } catch (e) {
                    console.error(`Ошибка чтения ${file}:`, e.message);
                    return null;
                }
            })
            .filter(p => p !== null);
        
        res.json(projects);
    } catch (error) {
        console.error('❌ Ошибка:', error);
        res.status(500).json({ error: error.message });
    }
});

// Сохранить проект (УЛУЧШЕННАЯ ВЕРСИЯ)
app.post('/api/projects/save', (req, res) => {
    try {
        console.log('💾 Запрос на сохранение проекта');
        console.log('Тело запроса:', JSON.stringify(req.body, null, 2));
        
        const { id, name, description, users, transactions } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Название проекта обязательно' });
        }
        
        const projectId = id || Date.now().toString();
        const fileName = `${projectId}.json`;
        const filePath = path.join(PROJECTS_DIR, fileName);
        
        const projectData = {
            id: projectId,
            name: name,
            description: description || '',
            lastModified: new Date().toISOString(),
            users: users || [],
            transactions: transactions || []
        };
        
        // Сохраняем с красивым форматированием
        fs.writeFileSync(filePath, JSON.stringify(projectData, null, 2));
        
        // Проверяем, что файл создался
        if (fs.existsSync(filePath)) {
            console.log(`✅ Проект сохранен: ${fileName} (${fs.statSync(filePath).size} bytes)`);
            res.json({ 
                success: true, 
                id: projectId,
                message: 'Проект успешно сохранен',
                path: filePath
            });
        } else {
            throw new Error('Файл не был создан');
        }
        
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

// Загрузить проект
app.get('/api/projects/load/:id', (req, res) => {
    try {
        const projectId = req.params.id;
        console.log(`📥 Запрос на загрузку проекта: ${projectId}`);
        
        const fileName = `${projectId}.json`;
        const filePath = path.join(PROJECTS_DIR, fileName);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Проект не найден' });
        }
        
        const projectData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.json(projectData);
        
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
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
            res.json({ success: true, message: 'Проект удален' });
        } else {
            res.status(404).json({ error: 'Проект не найден' });
        }
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        res.status(500).json({ error: error.message });
    }
});

// Запуск сервера
app.listen(PORT, HOST, () => {
    console.log('\n🚀 ==================================');
    console.log(`🚀 Сервер запущен на http://${HOST}:${PORT}`);
    console.log(`📁 Проекты сохраняются в: ${PROJECTS_DIR}`);
    
    // Показываем все доступные IP
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`🌐 Доступен по IP: http://${iface.address}:${PORT}`);
            }
        }
    }
    console.log('🚀 ==================================\n');
});

