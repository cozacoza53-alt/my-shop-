const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const https = require('https');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// НАЛАШТУВАННЯ TELEGRAM (Рекомендовано задавати через process.env)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8684094754:AAE_pk2y0GD-_mXEtYRgRKhGcjfoOnfRtFM';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '991742364';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Роздача статичних файлів сайту
app.use(express.static(path.join(__dirname)));

// НАЛАШТУВАННЯ ЗАВАНТАЖЕННЯ ФАЙЛІВ (MULTER)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Дозволені лише зображення!'));
        }
    }
});

// БАЗА ДАНИХ
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Помилка підключення до БД:', err.message);
    } else {
        console.log('Успішно підключено до бази даних SQLite.');
    }
});

// ІНІЦІАЛІЗАЦІЯ ТАБЛИЦЬ
db.serialize(() => {
    // Таблиця товарів
    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            brand TEXT NOT NULL,
            price REAL NOT NULL,
            description TEXT,
            img TEXT NOT NULL
        )
    `);

    // Таблиця замовлень
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT,
            phone TEXT,
            address TEXT,
            items TEXT,
            total_price REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Таблиця користувачів
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    `);

    // Початкове наповнення товарів
    db.get(`SELECT COUNT(*) AS count FROM products`, (err, row) => {
        if (row && row.count === 0) {
            const stmt = db.prepare(`INSERT INTO products (name, category, brand, price, img) VALUES (?, ?, ?, ?, ?)`);
            const initialProducts = [
                ["Орбітальна шліфмашина 3M", "Електроінструменти", "Bosch", 2370, JSON.stringify(["https://via.placeholder.com/300x200?text=Шліфмашина+1", "https://via.placeholder.com/300x200?text=Шліфмашина+2"])],
                ["Ключ трубний важільний", "Ручний інструмент", "Dremel", 960, JSON.stringify(["https://via.placeholder.com/300x200?text=Газовий+ключ"])],
                ["Будівельний фен 2000Вт", "Електроінструменти", "DeWalt", 1195, JSON.stringify(["https://via.placeholder.com/300x200?text=Термопістолет"])],
                ["Пневматичний пістолет", "Інструмент електрика", "Milwaukee", 3300, JSON.stringify(["https://via.placeholder.com/300x200?text=Пневмопістолет"])],
                ["Акумуляторний шурупокрут 18V", "Акумуляторні інструменти", "Makita", 1195, JSON.stringify(["https://via.placeholder.com/300x200?text=Шурупокрут"])],
                ["Вертикальний фрезер Bosch", "Електроінструменти", "Bosch", 4500, JSON.stringify(["https://via.placeholder.com/300x200?text=Фрезер"])]
            ];
            initialProducts.forEach(product => stmt.run(product));
            stmt.finalize();
            console.log('Базу даних успішно заповнено початковими товарами!');
        }
    });
});

// ==========================================
// MIDDLEWARE ПЕРЕВІРКИ РОЛЕЙ
// ==========================================
function checkRole(allowedRoles) {
    return (req, res, next) => {
        // Отримуємо роль з заголовків (або по дефолту 'user')
        const userRole = req.headers['x-user-role'] || 'user'; 

        if (allowedRoles.includes(userRole)) {
            next();
        } else {
            res.status(403).json({ error: 'Доступ заборонено: у вас недостатньо прав!' });
        }
    };
}

// HTML МАРШРУТИ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ==========================================
// API АВТОРИЗАЦІЇ ТА РЕЄСТРАЦІЇ
// ==========================================
app.post('/api/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role || 'user'; 
        
        db.run(
            `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
            [name, email, hashedPassword, userRole],
            function (err) {
                if (err) return res.status(400).json({ error: "Користувач із таким Email вже існує" });
                res.json({ success: true, user: { id: this.lastID, name, email, role: userRole } });
            }
        );
    } catch (error) {
        res.status(500).json({ error: "Помилка сервера при реєстрації" });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(
        `SELECT id, name, email, password, role FROM users WHERE email = ?`,
        [email],
        async (err, row) => {
            if (err || !row) return res.status(400).json({ error: "Невірний email або пароль" });

            const isMatch = await bcrypt.compare(password, row.password);
            if (!isMatch) return res.status(400).json({ error: "Невірний email або пароль" });

            res.json({ success: true, user: { id: row.id, name: row.name, email: row.email, role: row.role } });
        }
    );
});

// ==========================================
// API ТОВАРІВ
// ==========================================

// Отримати всі товари (відкрито для всіх)
app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Додавання товару (дозволено лише Admin та Manager)
app.post('/api/products', checkRole(['admin', 'manager']), upload.array('images', 10), (req, res) => {
    const { name, category, brand, price, description, img } = req.body;
    let imageList = [];

    if (req.files && req.files.length > 0) {
        imageList = req.files.map(file => `/uploads/${file.filename}`);
    } else if (img) {
        if (Array.isArray(img)) imageList = img;
        else if (typeof img === 'string') imageList = img.split(',').map(s => s.trim());
    }

    const imgData = JSON.stringify(imageList);

    db.run(
        `INSERT INTO products (name, category, brand, price, description, img) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, category, brand, parseFloat(price), description || '', imgData],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, name, category, brand, price, description, img: imgData });
        }
    );
});

// Редагування товару (дозволено лише Admin та Manager)
app.put('/api/products/:id', checkRole(['admin', 'manager']), upload.array('images', 10), (req, res) => {
    const productId = req.params.id;
    const { name, category, brand, price, description, existingImages } = req.body;

    let currentImages = [];
    if (existingImages) {
        try { currentImages = JSON.parse(existingImages); } 
        catch (e) { currentImages = Array.isArray(existingImages) ? existingImages : [existingImages]; }
    }

    if (req.files && req.files.length > 0) {
        const newUploaded = req.files.map(file => `/uploads/${file.filename}`);
        currentImages = [...currentImages, ...newUploaded];
    }

    const imgData = JSON.stringify(currentImages);

    db.run(
        `UPDATE products SET name = ?, category = ?, brand = ?, price = ?, description = ?, img = ? WHERE id = ?`,
        [name, category, brand, parseFloat(price), description || '', imgData, productId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Товар успішно оновлено!" });
        }
    );
});

// Видалення товару (тільки для Admin)
app.delete('/api/products/:id', checkRole(['admin']), (req, res) => {
    const productId = req.params.id;

    db.get(`SELECT img FROM products WHERE id = ?`, [productId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row && row.img) {
            try {
                const images = JSON.parse(row.img);
                images.forEach(imgPath => {
                    if (typeof imgPath === 'string' && imgPath.startsWith('/uploads/')) {
                        const relativePath = imgPath.slice(1);
                        const fullPath = path.join(__dirname, relativePath);
                        if (fs.existsSync(fullPath)) {
                            fs.unlinkSync(fullPath);
                        }
                    }
                });
            } catch (e) {
                console.error('Помилка при видаленні файлу з диска:', e);
            }
        }

        db.run(`DELETE FROM products WHERE id = ?`, [productId], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Товар та його файли успішно видалено" });
        });
    });
});

// ==========================================
// API ЗАМОВЛЕНЬ
// ==========================================

// Отримати замовлення (тільки для Admin та Manager)
app.get('/api/orders', checkRole(['admin', 'manager']), (req, res) => {
    db.all(`SELECT * FROM orders ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Створення замовлення та відправка в Telegram (відкрито для всіх покупців)
app.post('/api/orders', (req, res) => {
    const { customer_name, phone, address, items, total_price } = req.body;
    const itemsJson = typeof items === 'string' ? items : JSON.stringify(items);
    
    db.run(
        `INSERT INTO orders (customer_name, phone, address, items, total_price) VALUES (?, ?, ?, ?, ?)`,
        [customer_name, phone, address, itemsJson, parseFloat(total_price) || 0],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            
            const orderId = this.lastID;

            // Відправка повідомлення у Telegram
            if (TELEGRAM_TOKEN && TELEGRAM_CHAT_ID) {
                let itemsList = Array.isArray(items) ? items : [];
                if (typeof items === 'string') {
                    try { itemsList = JSON.parse(items); } catch(e){}
                }

                let itemsText = itemsList.map(i => `• ${i.name} (${i.qty || 1} шт.) — ${(i.price || 0) * (i.qty || 1)} ₴`).join('\n');
                
                const message = `🛒 *НОВЕ ЗАМОВЛЕННЯ №${orderId}*\n\n` +
                                `👤 *Покупець:* ${customer_name}\n` +
                                `📞 *Телефон:* ${phone}\n` +
                                `📍 *Адреса:* ${address}\n\n` +
                                `📦 *Товари:*\n${itemsText}\n\n` +
                                `💰 *Разом до сплати:* ${total_price} ₴`;

                const postData = JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: 'Markdown'
                });

                const options = {
                    hostname: 'api.telegram.org',
                    path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };

                const reqTelegram = https.request(options, (tRes) => {
                    let body = '';
                    tRes.on('data', chunk => body += chunk);
                    tRes.on('end', () => console.log('Відповідь Telegram API:', body));
                });

                reqTelegram.on('error', (tErr) => console.error('Помилка відправки в Telegram:', tErr));
                reqTelegram.write(postData);
                reqTelegram.end();
            }

            res.json({ success: true, orderId: orderId });
        }
    );
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер працює: http://localhost:${PORT}`);
});