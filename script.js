// ГЛОБАЛЬНІ ЗМІННІ СТАНУ
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

let currentCategory = 'all';
let currentBrand = 'all';
let maxPriceFilter = 10000;
let searchQuery = '';
let currentSort = 'default';

// Допоміжна функція для отримання ролі користувача
function getUserRole() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        return user && user.role ? user.role : 'user';
    } catch (e) {
        return 'user';
    }
}

// ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ ФОТОГРАФІЙ
function getFirstImage(imgData) {
    if (!imgData) return 'https://via.placeholder.com/300x200?text=Немає+фото';
    try {
        const parsed = JSON.parse(imgData);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch (e) {
        return imgData;
    }
    return imgData;
}

// ІНІЦІАЛІЗАЦІЯ ДОДАТКУ
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    updateCartUI();
    updateWishlistUI();
    checkAuthStatus();
    showPage('home');
});

// ЗАВАНТАЖЕННЯ ДАНИХ З СЕРВЕРА
function loadProducts() {
    fetch('/api/products')
        .then(res => res.json())
        .then(data => {
            products = data.map(item => {
                return {
                    ...item,
                    description: item.description || item.desc || item.details || item.info || item.about || item.text || ''
                };
            });

            renderCategoriesMenu();
            renderBrandsMenu();
            applyFilters();
        })
        .catch(err => console.error("Помилка завантаження товарів:", err));
}

// НАВІГАЦІЯ МІЖ СТОРІНКАМИ (SPA)
function showPage(pageId) {
    const pages = document.querySelectorAll('.page-section');
    pages.forEach(page => {
        page.classList.remove('active');
        page.style.display = '';
    });

    const activePage = document.getElementById(`page-${pageId}`);
    if (activePage) {
        activePage.classList.add('active');
    }

    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const navLink = document.getElementById(`nav-${pageId}`);
    if (navLink) navLink.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// РЕНДЕР КАТЕГОРІЙ ТА БРЕНДІВ З ЛІЧИЛЬНИКАМИ
function renderCategoriesMenu() {
    const catContainer = document.getElementById('category-menu');
    if (!catContainer) return;

    const counts = {};
    products.forEach(p => {
        if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
    });

    let html = `
        <li class="filter-item ${currentCategory === 'all' ? 'active' : ''}" onclick="filterByCategory('all')">
            <span class="filter-name">Усі категорії</span>
            <span class="filter-count">${products.length}</span>
        </li>
    `;

    html += Object.keys(counts).map(cat => {
        const safeCat = cat.replace(/'/g, "\\'");
        return `
            <li class="filter-item ${currentCategory === cat ? 'active' : ''}" onclick="filterByCategory('${safeCat}')">
                <span class="filter-name">${cat}</span>
                <span class="filter-count">${counts[cat]}</span>
            </li>
        `;
    }).join('');

    catContainer.innerHTML = html;
}

function renderBrandsMenu() {
    const brandContainer = document.getElementById('brand-menu');
    if (!brandContainer) return;

    const counts = {};
    products.forEach(p => {
        if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1;
    });

    let html = `
        <li class="filter-item ${currentBrand === 'all' ? 'active' : ''}" onclick="filterByBrand('all')">
            <span class="filter-name">Усі бренди</span>
            <span class="filter-count">${products.length}</span>
        </li>
    `;

    html += Object.keys(counts).map(b => {
        const safeBrand = b.replace(/'/g, "\\'");
        return `
            <li class="filter-item ${currentBrand === b ? 'active' : ''}" onclick="filterByBrand('${safeBrand}')">
                <span class="filter-name">${b}</span>
                <span class="filter-count">${counts[b]}</span>
            </li>
        `;
    }).join('');

    brandContainer.innerHTML = html;
}

function filterByCategory(cat) {
    currentCategory = cat;
    showPage('home');

    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) resetBtn.style.display = (cat !== 'all' || currentBrand !== 'all') ? 'inline-block' : 'none';
    
    renderCategoriesMenu();
    applyFilters();
}

function filterByBrand(brand) {
    currentBrand = brand;
    showPage('home');

    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) resetBtn.style.display = (brand !== 'all' || currentCategory !== 'all') ? 'inline-block' : 'none';

    renderBrandsMenu();
    applyFilters();
}

function resetFilters() {
    currentCategory = 'all';
    currentBrand = 'all';
    searchQuery = '';
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';

    const priceRange = document.getElementById('price-range');
    if (priceRange) {
        priceRange.value = 10000;
        maxPriceFilter = 10000;
    }
    
    const resetBtn = document.getElementById('reset-filter-btn');
    if (resetBtn) resetBtn.style.display = 'none';

    renderCategoriesMenu();
    renderBrandsMenu();
    applyFilters();
}

function handleSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchQuery = searchInput.value.toLowerCase().trim();
        applyFilters();
    }
}

// ФІЛЬТРАЦІЯ ТА ВІДОБРАЖЕННЯ ТОВАРІВ
function applyFilters() {
    const priceRange = document.getElementById('price-range');
    const priceLimit = document.getElementById('price-limit');
    const sortSelect = document.getElementById('sort-select');

    if (priceRange) maxPriceFilter = parseFloat(priceRange.value);
    if (priceLimit) priceLimit.innerText = `${maxPriceFilter} ₴`;
    if (sortSelect) currentSort = sortSelect.value;

    let result = [...products];

    if (currentCategory !== 'all') {
        result = result.filter(p => p.category === currentCategory);
    }

    if (currentBrand !== 'all') {
        result = result.filter(p => p.brand === currentBrand);
    }

    result = result.filter(p => p.price <= maxPriceFilter);

    if (searchQuery !== '') {
        result = result.filter(p => 
            p.name.toLowerCase().includes(searchQuery) || 
            (p.brand && p.brand.toLowerCase().includes(searchQuery))
        );
    }

    if (currentSort === 'asc') {
        result.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'desc') {
        result.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'name') {
        result.sort((a, b) => a.name.localeCompare(b.name));
    }

    renderProducts(result);
}

function renderProducts(items) {
    const container = document.getElementById('products-container');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #777;">
                <h3>Товарів не знайдено</h3>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(product => {
        const isWish = wishlist.includes(product.id);
        return `
            <div class="product-card" onclick="openProductModal(${product.id})">
                <button class="btn-wishlist ${isWish ? 'active' : ''}" 
                        onclick="event.stopPropagation(); toggleWishlist(${product.id})" 
                        style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 20px; color: ${isWish ? 'red' : '#ccc'}; cursor: pointer;">
                    ♥
                </button>
                <img src="${getFirstImage(product.img)}" alt="${product.name}" class="product-img" style="width: 100%; height: 180px; object-fit: contain;">
                <div class="product-info" style="padding: 10px;">
                    <span style="font-size: 12px; color: #888;">${product.brand || ''}</span>
                    <h3 style="font-size: 15px; margin: 5px 0;">${product.name}</h3>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                        <span style="font-weight: bold; font-size: 16px;">${product.price} ₴</span>
                        <button onclick="event.stopPropagation(); addToCart(${product.id})" style="background: #ffe800; border: none; padding: 6px 12px; font-weight: bold; cursor: pointer; border-radius: 4px;">
                            У кошик
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// МОДАЛЬНЕ ВІКНО ТОВАРУ ТА СЛАЙДЕР
let currentModalImages = [];
let currentModalImageIndex = 0;

function getAllImages(imgData) {
    if (!imgData) return ['https://via.placeholder.com/300x200?text=Немає+фото'];
    try {
        const parsed = JSON.parse(imgData);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
        if (typeof imgData === 'string' && imgData.trim() !== '') {
            return [imgData];
        }
    }
    return ['https://via.placeholder.com/300x200?text=Немає+фото'];
}

function openProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('product-modal');
    if (!modal) return;

    currentModalImages = getAllImages(product.img);
    currentModalImageIndex = 0;

    document.getElementById('modal-p-name').innerText = product.name || '';
    document.getElementById('modal-p-brand').innerText = product.brand || 'Не вказано';
    document.getElementById('modal-p-category').innerText = product.category || 'Загальна';
    document.getElementById('modal-p-price').innerText = product.price || 0;

    const productDesc = product.description || 
                        product.desc || 
                        product.details || 
                        product.info || 
                        product.about || 
                        product.text || 
                        product.specification || 
                        'Опис відсутній.';

    const descElement = document.getElementById('modal-p-description');
    if (descElement) {
        descElement.innerText = productDesc;
    }

    const addBtn = document.getElementById('modal-add-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            addToCart(product.id);
            closeProductModal();
        };
    }

    updateModalSliderUI();
    modal.style.display = 'flex';
}

function updateModalSliderUI() {
    const imgEl = document.getElementById('modal-p-img');
    const prevBtn = document.getElementById('modal-slider-prev');
    const nextBtn = document.getElementById('modal-slider-next');
    const thumbsContainer = document.getElementById('modal-thumbs-container');

    imgEl.src = currentModalImages[currentModalImageIndex];

    if (currentModalImages.length > 1) {
        if (prevBtn) prevBtn.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'block';
        if (thumbsContainer) {
            thumbsContainer.style.display = 'flex';
            thumbsContainer.innerHTML = currentModalImages.map((src, idx) => `
                <img src="${src}" class="${idx === currentModalImageIndex ? 'active' : ''}" onclick="setModalSlide(${idx})">
            `).join('');
        }
    } else {
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (thumbsContainer) thumbsContainer.style.display = 'none';
    }
}

function changeModalSlide(direction) {
    currentModalImageIndex += direction;
    if (currentModalImageIndex < 0) {
        currentModalImageIndex = currentModalImages.length - 1;
    } else if (currentModalImageIndex >= currentModalImages.length) {
        currentModalImageIndex = 0;
    }
    updateModalSliderUI();
}

function setModalSlide(index) {
    currentModalImageIndex = index;
    updateModalSliderUI();
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    if (modal) modal.style.display = 'none';
}

// КОШИК
function toggleCart() {
    const modal = document.getElementById('cart-modal');
    if (!modal) return;

    if (modal.style.display === 'flex' || modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
    }
}

function goToCheckout() {
    toggleCart();
    showPage('checkout');
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        cart[itemIndex].qty += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            img: getFirstImage(product.img),
            qty: 1
        });
    }

    saveCart();
    updateCartUI();
}

function updateCartQty(productId, delta) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        cart[itemIndex].qty += delta;
        if (cart[itemIndex].qty <= 0) {
            cart.splice(itemIndex, 1);
        }
    }
    saveCart();
    updateCartUI();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartUI() {
    const cartCount = document.getElementById('cart-count');
    const container = document.getElementById('cart-items-container');
    const totalPriceEl = document.getElementById('cart-total-price');
    const checkoutTotalEl = document.getElementById('checkout-total-price');

    const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    if (cartCount) cartCount.innerText = totalQty;
    if (totalPriceEl) totalPriceEl.innerText = totalPrice;
    if (checkoutTotalEl) checkoutTotalEl.innerText = totalPrice;

    if (container) {
        if (cart.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #777;">Ваш кошик порожній</p>';
        } else {
            container.innerHTML = cart.map(item => `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                    <img src="${item.img}" style="width: 40px; height: 40px; object-fit: contain;">
                    <div style="flex: 1; margin: 0 10px;">
                        <div style="font-weight: bold; font-size: 13px;">${item.name}</div>
                        <div style="color: #666; font-size: 12px;">${item.price} ₴</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button onclick="updateCartQty(${item.id}, -1)" style="padding: 2px 6px;">-</button>
                        <span>${item.qty}</span>
                        <button onclick="updateCartQty(${item.id}, 1)" style="padding: 2px 6px;">+</button>
                    </div>
                    <button onclick="removeFromCart(${item.id})" style="background: none; border: none; color: red; cursor: pointer; margin-left: 10px;">✕</button>
                </div>
            `).join('');
        }
    }
}

// WISHLIST
function toggleWishlist(productId) {
    const index = wishlist.indexOf(productId);
    if (index > -1) {
        wishlist.splice(index, 1);
    } else {
        wishlist.push(productId);
    }
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateWishlistUI();
    applyFilters();
}

function updateWishlistUI() {
    const wishCount = document.getElementById('wish-count');
    if (wishCount) wishCount.innerText = wishlist.length;

    const wishContainer = document.getElementById('wishlist-container');
    if (!wishContainer) return;

    const wishProducts = products.filter(p => wishlist.includes(p.id));

    if (wishProducts.length === 0) {
        wishContainer.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Список бажань порожній</p>';
        return;
    }

    wishContainer.innerHTML = wishProducts.map(product => `
        <div class="product-card">
            <img src="${getFirstImage(product.img)}" class="product-img" style="width:100%; height:180px; object-fit:contain;">
            <div style="padding: 10px;">
                <h3>${product.name}</h3>
                <p><strong>${product.price} ₴</strong></p>
                <button onclick="addToCart(${product.id})" style="background:#ffe800; border:none; padding:8px 12px; cursor:pointer;">У кошик</button>
                <button onclick="toggleWishlist(${product.id})" style="background:red; color:#fff; border:none; padding:8px 12px; cursor:pointer;">Видалити</button>
            </div>
        </div>
    `).join('');
}

// ОФОРМЛЕННЯ ЗАМОВЛЕННЯ
async function processOrder(e) {
    e.preventDefault();
    
    if (cart.length === 0) {
        alert('Ваш кошик порожній! Додайте товари перед оформленням.');
        showPage('home');
        return;
    }

    const TELEGRAM_BOT_TOKEN = '8684094754:AAE_pk2y0GD-_mXEtYRgRKhGcjfoOnfRtFM';
    const TELEGRAM_CHAT_ID = '991742364';

    const orderName = document.getElementById('order-name').value;
    const orderPhone = document.getElementById('order-phone').value;
    const orderAddress = document.getElementById('order-address').value;
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const orderData = {
        customer_name: orderName,
        phone: orderPhone,
        address: orderAddress,
        items: JSON.stringify(cart),
        total_price: totalPrice
    };

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            throw new Error('Помилка збереження замовлення на сервері');
        }

        const resData = await response.json();
        const createdOrderId = resData.orderId || Date.now();

        let itemsList = cart.map((item, index) => 
            `${index + 1}. ${item.name} — ${item.qty} шт. x ${item.price} ₴`
        ).join('\n');

        const message = `🛒 *НОВЕ ЗАМОВЛЕННЯ №${createdOrderId}!*\n\n` +
                        `👤 *Клієнт:* ${orderName}\n` +
                        `📞 *Телефон:* ${orderPhone}\n` +
                        `📍 *Адреса/Відділення:* ${orderAddress}\n\n` +
                        `📦 *Товари:*\n${itemsList}\n\n` +
                        `💰 *Сума до сплати:* ${totalPrice} ₴`;

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        alert(`Дякуємо, ${orderName}! Ваше замовлення успішно оформлено!`);

        cart = [];
        saveCart();
        updateCartUI();
        
        const checkoutForm = document.getElementById('checkout-form');
        if (checkoutForm) checkoutForm.reset();
        
        showPage('home');

        if (typeof loadOrders === 'function') loadOrders();

    } catch (err) {
        console.error('Помилка при оформленні замовлення:', err);
        alert('Виникла помилка при оформленні замовлення. Спробуйте ще раз.');
    }
}

// АВТОРИЗАЦІЯ
function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('reg-form');
    const tabLoginBtn = document.getElementById('tab-login-btn');
    const tabRegBtn = document.getElementById('tab-reg-btn');

    if (tab === 'login') {
        if (loginForm) loginForm.style.display = 'block';
        if (regForm) regForm.style.display = 'none';
        if (tabLoginBtn) tabLoginBtn.style.borderBottom = '2px solid #ffe800';
        if (tabRegBtn) tabRegBtn.style.borderBottom = 'none';
    } else {
        if (loginForm) loginForm.style.display = 'none';
        if (regForm) regForm.style.display = 'block';
        if (tabRegBtn) tabRegBtn.style.borderBottom = '2px solid #ffe800';
        if (tabLoginBtn) tabLoginBtn.style.borderBottom = 'none';
    }
}

function checkAuthStatus() {
    const user = JSON.parse(localStorage.getItem('user'));
    const authForms = document.getElementById('auth-forms');
    const userProfile = document.getElementById('user-profile');

    if (user && authForms && userProfile) {
        authForms.style.display = 'none';
        userProfile.style.display = 'block';
        document.getElementById('user-name-display').innerText = user.name;
        document.getElementById('user-email-display').innerText = user.email;
    }
}

// Вхід через API сервера
async function handleUserLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password') ? document.getElementById('login-password').value : '';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            checkAuthStatus();
            alert('Успішний вхід!');
        } else {
            alert(data.error || 'Помилка входу');
        }
    } catch (err) {
        // Запасний варіант, якщо сервер не має вказаного маршруту
        const user = { name: 'Користувач', email: email, role: 'user' };
        localStorage.setItem('user', JSON.stringify(user));
        checkAuthStatus();
    }
}

// Реєстрація через API сервера
async function handleUserRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password') ? document.getElementById('reg-password').value : '';

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            checkAuthStatus();
            alert('Реєстрація успішна!');
        } else {
            alert(data.error || 'Помилка реєстрації');
        }
    } catch (err) {
        const user = { name: name, email: email, role: 'user' };
        localStorage.setItem('user', JSON.stringify(user));
        checkAuthStatus();
    }
}

function handleUserLogout() {
    localStorage.removeItem('user');
    const authForms = document.getElementById('auth-forms');
    const userProfile = document.getElementById('user-profile');
    if (authForms) authForms.style.display = 'block';
    if (userProfile) userProfile.style.display = 'none';
}