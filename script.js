// ===== نظام سلة التسوق =====
let cartItems = JSON.parse(sessionStorage.getItem('jokerCart')) || [];

// ===== قناة البث المشتركة =====
let dataChannel;

// ===== تهيئة التطبيق =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('جاري تهيئة المتجر...');
    
    // إنشاء قناة بث مشتركة
    try {
        dataChannel = new BroadcastChannel('joker-store-data');
        console.log('تم إنشاء قناة البث المشتركة للمتجر');
        
        // الاستماع للرسائل من لوحة الإدارة
        dataChannel.onmessage = function(event) {
            const message = event.data;
            console.log('تم استقبال رسالة:', message);
            
            switch(message.type) {
                case 'productsUpdated':
                    console.log('تم تحديث المنتجات من لوحة الإدارة');
                    updateStoreProducts();
                    showCartNotification('تم تحديث قائمة المنتجات');
                    break;
                    
                case 'categoriesUpdated':
                    console.log('تم تحديث الفئات من لوحة الإدارة');
                    updateStoreProducts();
                    break;
                    
                case 'forceUpdate':
                    console.log('طلب تحديث قسري من لوحة الإدارة');
                    updateStoreProducts();
                    showCartNotification('تم تحديث المتجر');
                    break;
            }
        };
    } catch (error) {
        console.log('Browser does not support BroadcastChannel');
    }
    
    // تهيئة المكونات
    initFilters();
    initCart();
    initModals();
    initMobileMenu();
    
    // تحميل البيانات
    updateStoreProducts();
    loadCartFromStorage();
    updateCartCount();
    
    console.log('تم تهيئة المتجر بنجاح!');
});

// ===== دالة تحميل المنتجات من sessionStorage =====
function loadProductsFromStorage() {
    try {
        // جلب المنتجات من sessionStorage
        const storedProducts = sessionStorage.getItem('jokerProducts');
        if (storedProducts) {
            return JSON.parse(storedProducts);
        } else {
            // إذا لم توجد بيانات، نستخدم البيانات الافتراضية
            return [
                {
                    id: 1,
                    name: "لابتوب Dell XPS 13",
                    description: "لابتوب رفيع وخفيف مع شاشة لامتناهية وأداء قوي، مثالي للعمل والترفيه",
                    price: 25000,
                    category: "dell",
                    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
                    specs: {
                        "المعالج": "Intel Core i7 الجيل العاشر",
                        "الذاكرة": "16GB RAM",
                        "التخزين": "512GB SSD",
                        "الشاشة": "13.3 بوصة 4K",
                        "البطارية": "12 ساعة"
                    },
                    dateAdded: "2024-01-15"
                },
                {
                    id: 2,
                    name: "ماك بوك برو 16 بوصة",
                    description: "أقوى لابتوب من Apple مع شاشة Retina وأداء استثنائي للمحترفين",
                    price: 45000,
                    category: "apple",
                    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
                    specs: {
                        "المعالج": "Apple M1 Pro",
                        "الذاكرة": "32GB RAM",
                        "التخزين": "1TB SSD",
                        "الشاشة": "16 بوصة Retina",
                        "البطارية": "20 ساعة"
                    },
                    dateAdded: "2024-01-10"
                },
                {
                    id: 3,
                    name: "لابتوب HP Spectre x360",
                    description: "لابتوب قابل للتحويل بشاشة تعمل باللمس، يجمع بين القوة والأناقة",
                    price: 22000,
                    category: "hp",
                    image: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
                    specs: {
                        "المعالج": "Intel Core i5",
                        "الذاكرة": "8GB RAM",
                        "التخزين": "256GB SSD",
                        "الشاشة": "13.5 بوصة لمس",
                        "الوزن": "1.3 كجم"
                    },
                    dateAdded: "2024-01-05"
                }
            ];
        }
    } catch (error) {
        console.error('خطأ في تحميل المنتجات:', error);
        return [];
    }
}

// ===== دالة تحميل الفئات من sessionStorage =====
function loadCategoriesFromStorage() {
    try {
        const storedCategories = sessionStorage.getItem('jokerCategories');
        if (storedCategories) {
            return JSON.parse(storedCategories);
        } else {
            return [
                { id: 'dell', name: 'Dell', icon: 'laptop' },
                { id: 'apple', name: 'Apple', icon: 'apple' },
                { id: 'hp', name: 'HP', icon: 'laptop' },
                { id: 'lenovo', name: 'Lenovo', icon: 'laptop' },
                { id: 'asus', name: 'Asus', icon: 'laptop' },
                { id: 'other', name: 'أخرى', icon: 'box' }
            ];
        }
    } catch (error) {
        console.error('خطأ في تحميل الفئات:', error);
        return [];
    }
}

// ===== دالة لتحديث عرض المنتجات في المتجر الرئيسي =====
function updateStoreProducts() {
    const products = loadProductsFromStorage();
    const categories = loadCategoriesFromStorage();
    
    // تحديث شبكة المنتجات
    const productsGrid = document.getElementById('products-grid');
    if (productsGrid) {
        productsGrid.innerHTML = '';
        
        if (products.length === 0) {
            productsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>لا توجد منتجات حالياً</h3>
                    <p>سيتم إضافة المنتجات قريباً</p>
                </div>
            `;
            
            // إظهار رسالة لا توجد منتجات
            const noProducts = document.getElementById('no-products');
            if (noProducts) noProducts.classList.remove('hidden');
            return;
        }
        
        // إخفاء رسالة لا توجد منتجات
        const noProducts = document.getElementById('no-products');
        if (noProducts) noProducts.classList.add('hidden');
        
        products.forEach(product => {
            // العثور على اسم الفئة
            const category = categories.find(cat => cat.id === product.category);
            const categoryName = category ? category.name : product.category;
            const categoryIcon = category ? category.icon : 'tag';
            
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.dataset.category = product.category;
            productCard.dataset.id = product.id;
            
            productCard.innerHTML = `
                <div class="product-image">
                    <img src="${product.image}" alt="${product.name}" 
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/500x300?text=لا+توجد+صورة'">
                </div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p class="product-description">${product.description || ''}</p>
                    <div class="product-price">${product.price.toLocaleString()} ج.م</div>
                    <div class="product-category">
                        <i class="fas fa-${categoryIcon}"></i> ${categoryName}
                    </div>
                    <button class="btn btn-primary add-to-cart" data-id="${product.id}">
                        <i class="fas fa-cart-plus"></i> أضف إلى السلة
                    </button>
                    <button class="btn btn-secondary view-details" data-id="${product.id}">
                        <i class="fas fa-eye"></i> تفاصيل المنتج
                    </button>
                </div>
            `;
            
            productsGrid.appendChild(productCard);
        });
        
        // إضافة event listeners للأزرار
        setTimeout(() => {
            document.querySelectorAll('.add-to-cart').forEach(button => {
                button.addEventListener('click', function() {
                    const productId = parseInt(this.dataset.id);
                    addToCart(productId);
                });
            });
            
            document.querySelectorAll('.view-details').forEach(button => {
                button.addEventListener('click', function() {
                    const productId = parseInt(this.dataset.id);
                    showProductDetails(productId);
                });
            });
        }, 100);
    }
}

// ===== دوال سلة التسوق =====
function addToCart(productId) {
    const products = loadProductsFromStorage();
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        showCartNotification('المنتج غير موجود!', 'error');
        return;
    }
    
    const existingItem = cartItems.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cartItems.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }
    
    saveCartToStorage();
    updateCartCount();
    showCartNotification('تمت إضافة المنتج إلى السلة!');
}

function removeFromCart(productId) {
    cartItems = cartItems.filter(item => item.id !== productId);
    saveCartToStorage();
    updateCartCount();
    updateCartModal();
    showCartNotification('تمت إزالة المنتج من السلة');
}

function updateCartItemQuantity(productId, newQuantity) {
    const item = cartItems.find(item => item.id === productId);
    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = newQuantity;
            saveCartToStorage();
            updateCartCount();
            updateCartModal();
        }
    }
}

function saveCartToStorage() {
    sessionStorage.setItem('jokerCart', JSON.stringify(cartItems));
}

function loadCartFromStorage() {
    const storedCart = sessionStorage.getItem('jokerCart');
    if (storedCart) {
        cartItems = JSON.parse(storedCart);
    }
}

function updateCartCount() {
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
        cartCountElement.textContent = totalItems;
    }
}

// ===== عرض تفاصيل المنتج =====
function showProductDetails(productId) {
    const products = loadProductsFromStorage();
    const product = products.find(p => p.id === productId);
    
    if (!product) return;
    
    const categories = loadCategoriesFromStorage();
    const category = categories.find(cat => cat.id === product.category);
    const categoryName = category ? category.name : product.category;
    
    let specsHtml = '';
    if (product.specs && Object.keys(product.specs).length > 0) {
        specsHtml = '<div class="product-specs"><h4>المواصفات:</h4><ul>';
        for (const [key, value] of Object.entries(product.specs)) {
            specsHtml += `<li><strong>${key}:</strong> ${value}</li>`;
        }
        specsHtml += '</ul></div>';
    }
    
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <div class="product-details">
            <div class="product-details-image">
                <img src="${product.image}" alt="${product.name}" 
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/500x300?text=لا+توجد+صورة'">
            </div>
            <div class="product-details-info">
                <h2>${product.name}</h2>
                <p class="product-description">${product.description || 'لا يوجد وصف للمنتج'}</p>
                <div class="product-price">${product.price.toLocaleString()} ج.م</div>
                <div class="product-category">
                    <i class="fas fa-tag"></i> ${categoryName}
                </div>
                ${specsHtml}
                <div class="product-details-actions">
                    <button class="btn btn-primary" id="add-to-cart-modal" data-id="${product.id}">
                        <i class="fas fa-cart-plus"></i> أضف إلى السلة
                    </button>
                    <button class="btn btn-secondary close-modal-btn">
                        <i class="fas fa-times"></i> إغلاق
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // إضافة event listeners للأزرار
    setTimeout(() => {
        document.getElementById('add-to-cart-modal').addEventListener('click', function() {
            addToCart(productId);
            closeModal('product-modal');
        });
        
        document.querySelector('.close-modal-btn').addEventListener('click', function() {
            closeModal('product-modal');
        });
    }, 100);
    
    showModal('product-modal');
}

// ===== دوال التصفية =====
function initFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('top-search');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.dataset.filter;
            
            // تحديث الأزرار النشطة
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // تطبيق الفلتر
            applyFilter(filter);
        });
    });
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            filterProductsBySearch(searchTerm);
        });
    }
}

function applyFilter(filter) {
    const productCards = document.querySelectorAll('.product-card');
    const noProducts = document.getElementById('no-products');
    
    let visibleCount = 0;
    
    productCards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    if (noProducts) {
        if (visibleCount === 0) {
            noProducts.classList.remove('hidden');
        } else {
            noProducts.classList.add('hidden');
        }
    }
}

function filterProductsBySearch(searchTerm) {
    const productCards = document.querySelectorAll('.product-card');
    const noProducts = document.getElementById('no-products');
    
    let visibleCount = 0;
    
    productCards.forEach(card => {
        const productName = card.querySelector('h3').textContent.toLowerCase();
        const productDescription = card.querySelector('.product-description').textContent.toLowerCase();
        
        if (productName.includes(searchTerm) || productDescription.includes(searchTerm) || searchTerm === '') {
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    if (noProducts) {
        if (visibleCount === 0 && searchTerm !== '') {
            noProducts.classList.remove('hidden');
        } else {
            noProducts.classList.add('hidden');
        }
    }
}

// ===== دوال الموديلات =====
function initModals() {
    const cartIcon = document.getElementById('cart-icon');
    const closeModalButtons = document.querySelectorAll('.close-modal');
    const continueShoppingBtn = document.getElementById('continue-shopping');
    const checkoutWhatsappBtn = document.getElementById('checkout-whatsapp');
    
    // سلة التسوق
    if (cartIcon) {
        cartIcon.addEventListener('click', function() {
            updateCartModal();
            showModal('cart-modal');
        });
    }
    
    // إغلاق الموديلات
    closeModalButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modalId = this.closest('.modal').id;
            closeModal(modalId);
        });
    });
    
    // مواصلة التسوق
    if (continueShoppingBtn) {
        continueShoppingBtn.addEventListener('click', function() {
            closeModal('cart-modal');
        });
    }
    
    // إتمام الطلب عبر واتساب
    if (checkoutWhatsappBtn) {
        checkoutWhatsappBtn.addEventListener('click', function() {
            checkoutViaWhatsApp();
        });
    }
    
    // إغلاق الموديلات عند النقر خارجها
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// ===== تحديث موديل السلة =====
function updateCartModal() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');
    
    if (!cartItemsContainer) return;
    
    if (cartItems.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <h4>سلة التسوق فارغة</h4>
                <p>أضف بعض المنتجات إلى سلة التسوق</p>
            </div>
        `;
        if (cartTotalElement) cartTotalElement.textContent = '0 ج.م';
        return;
    }
    
    let total = 0;
    let itemsHtml = '';
    
    cartItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        itemsHtml += `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}" 
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/100x100?text=صورة'">
                </div>
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <div class="cart-item-price">${item.price.toLocaleString()} ج.م</div>
                </div>
                <div class="cart-item-quantity">
                    <button class="quantity-btn minus" data-id="${item.id}">-</button>
                    <span class="quantity">${item.quantity}</span>
                    <button class="quantity-btn plus" data-id="${item.id}">+</button>
                </div>
                <div class="cart-item-total">${itemTotal.toLocaleString()} ج.م</div>
                <button class="cart-item-remove" data-id="${item.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    
    cartItemsContainer.innerHTML = itemsHtml;
    if (cartTotalElement) cartTotalElement.textContent = total.toLocaleString() + ' ج.م';
    
    // إضافة event listeners للأزرار
    setTimeout(() => {
        document.querySelectorAll('.quantity-btn.minus').forEach(button => {
            button.addEventListener('click', function() {
                const productId = parseInt(this.dataset.id);
                const item = cartItems.find(item => item.id === productId);
                if (item) {
                    updateCartItemQuantity(productId, item.quantity - 1);
                }
            });
        });
        
        document.querySelectorAll('.quantity-btn.plus').forEach(button => {
            button.addEventListener('click', function() {
                const productId = parseInt(this.dataset.id);
                const item = cartItems.find(item => item.id === productId);
                if (item) {
                    updateCartItemQuantity(productId, item.quantity + 1);
                }
            });
        });
        
        document.querySelectorAll('.cart-item-remove').forEach(button => {
            button.addEventListener('click', function() {
                const productId = parseInt(this.dataset.id);
                removeFromCart(productId);
            });
        });
    }, 100);
}

// ===== إتمام الطلب عبر واتساب =====
function checkoutViaWhatsApp() {
    if (cartItems.length === 0) {
        showCartNotification('سلة التسوق فارغة', 'error');
        return;
    }
    
    let message = 'مرحباً، أرغب في طلب المنتجات التالية:\n\n';
    let total = 0;
    
    cartItems.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        message += `${index + 1}. ${item.name} - ${item.quantity} × ${item.price.toLocaleString()} ج.م = ${itemTotal.toLocaleString()} ج.م\n`;
    });
    
    message += `\nالمجموع الكلي: ${total.toLocaleString()} ج.م\n\n`;
    message += `اسمي: _________\nرقم هاتفي: _________\nالعنوان: _________\n\nشكراً!`;
    
    const phoneNumber = '201010022271'; // استبدل برقم الهاتف الفعلي
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    // تفريغ السلة بعد الطلب
    cartItems = [];
    saveCartToStorage();
    updateCartCount();
    updateCartModal();
    closeModal('cart-modal');
    
    showCartNotification('تم فتح واتساب لإتمام الطلب');
}

// ===== القائمة المتنقلة =====
function initMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const closeMobileMenu = document.getElementById('close-mobile-menu');
    const mobileMenuContent = document.getElementById('mobile-menu-content');
    
    if (mobileMenuToggle && mobileMenuContent) {
        mobileMenuToggle.addEventListener('click', function() {
            const navLinks = document.querySelectorAll('#main-nav a');
            let menuHtml = '<nav class="mobile-nav">';
            
            navLinks.forEach(link => {
                menuHtml += `<a href="${link.href}">${link.textContent}</a>`;
            });
            
            menuHtml += '</nav>';
            mobileMenuContent.innerHTML = menuHtml;
            
            showModal('mobile-menu-modal');
        });
    }
    
    if (closeMobileMenu) {
        closeMobileMenu.addEventListener('click', function() {
            closeModal('mobile-menu-modal');
        });
    }
}

// ===== إشعارات =====
function showCartNotification(message, type = 'success') {
    // إنشاء عنصر الإشعار
    const notification = document.createElement('div');
    notification.className = `cart-notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // إظهار الإشعار
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // إخفاء الإشعار بعد 3 ثوان
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ===== إضافة الأنماط للإشعارات =====
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .cart-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 9999;
        transform: translateX(150%);
        transition: transform 0.3s ease;
        max-width: 400px;
    }
    
    .cart-notification.error {
        background: #dc3545;
    }
    
    .cart-notification.show {
        transform: translateX(0);
    }
    
    .cart-notification i {
        font-size: 20px;
    }
    
    .empty-state {
        text-align: center;
        padding: 40px;
        color: #666;
        grid-column: 1 / -1;
    }
    
    .empty-state i {
        font-size: 60px;
        color: #e1e5eb;
        margin-bottom: 20px;
    }
    
    .empty-cart {
        text-align: center;
        padding: 40px;
        color: #666;
    }
    
    .empty-cart i {
        font-size: 60px;
        color: #e1e5eb;
        margin-bottom: 20px;
    }
    
    .product-details {
        display: flex;
        gap: 30px;
        padding: 20px;
    }
    
    .product-details-image {
        flex: 1;
        max-width: 400px;
    }
    
    .product-details-image img {
        width: 100%;
        border-radius: 10px;
    }
    
    .product-details-info {
        flex: 2;
    }
    
    .product-details-actions {
        display: flex;
        gap: 15px;
        margin-top: 30px;
    }
    
    .product-specs {
        margin-top: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .product-specs ul {
        list-style: none;
        padding: 0;
        margin: 10px 0 0;
    }
    
    .product-specs li {
        padding: 5px 0;
        border-bottom: 1px dashed #ddd;
    }
    
    .product-specs li:last-child {
        border-bottom: none;
    }
    
    @media (max-width: 768px) {
        .product-details {
            flex-direction: column;
        }
        
        .product-details-image {
            max-width: 100%;
        }
        
        .cart-notification {
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
        }
    }
`;
document.head.appendChild(notificationStyles);

// ===== الاستماع لأحداث التحديث من sessionStorage =====
window.addEventListener('storage', function(event) {
    if (event.key === 'jokerProducts' || event.key === 'jokerCategories') {
        console.log('تم اكتشاف تغيير في sessionStorage');
        updateStoreProducts();
    }
});

// ===== تحديث المنتجات بشكل دوري =====
setInterval(() => {
    updateStoreProducts();
}, 30000); // تحديث كل 30 ثانية

console.log('تم تحميل script.js بنجاح');