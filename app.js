// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyB6XbZbLR8C1osz3yEprlYL5vuCnbKX6eo",
  authDomain: "puntoventa-ffd33.firebaseapp.com",
  projectId: "puntoventa-ffd33",
  storageBucket: "puntoventa-ffd33.firebasestorage.app",
  messagingSenderId: "618852946172",
  appId: "1:618852946172:web:0ef1c8b3094c27490d0779",
  measurementId: "G-8S57RYLNEB"
};

// Initialize Firebase (Compat Version)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Load Config from LocalStorage immediately for Theme before login
let globalConfig = {
    nombre_tienda: 'OmniPOS',
    color_primary: '#1E293B',
    color_accent: '#3B82F6',
    logo_b64: null
};

try {
    const localConf = localStorage.getItem('omnipos_config');
    if (localConf) {
        globalConfig = { ...globalConfig, ...JSON.parse(localConf) };
        document.documentElement.style.setProperty('--color-primary', globalConfig.color_primary);
        document.documentElement.style.setProperty('--color-secondary', globalConfig.color_primary);
        document.documentElement.style.setProperty('--color-accent', globalConfig.color_accent);
        document.documentElement.style.setProperty('--color-accent-hover', globalConfig.color_accent);
        
        // The script is at the end of the body, so the DOM is already parsed
        document.querySelectorAll('.app-title-display').forEach(el => el.innerText = globalConfig.nombre_tienda);
        document.title = globalConfig.nombre_tienda + " - Punto de Venta";
        
        document.querySelectorAll('.app-logo-display').forEach(img => {
            if(globalConfig.logo_b64) {
                img.src = globalConfig.logo_b64;
                img.classList.remove('hidden');
            }
        });
    }
} catch (e) {
    console.error("Error loading local config:", e);
}

// Global State
let currentUser = null;
let userRole = 'auxiliar'; // Default to lowest privilege

// --- UI Helpers ---
window.openModal = (id) => {
    const m = document.getElementById(id);
    if(m) {
        m.classList.remove('hidden');
        setTimeout(() => m.classList.remove('opacity-0'), 10);
        setTimeout(() => m.querySelector('.transform').classList.remove('scale-95'), 10);
    }
};

window.closeModal = (id) => {
    const m = document.getElementById(id);
    if(m) {
        m.classList.add('opacity-0');
        m.querySelector('.transform').classList.add('scale-95');
        setTimeout(() => m.classList.add('hidden'), 300);
    }
};

const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 text-sm font-medium ${type === 'error' ? 'toast-error' : type === 'info' ? 'toast-info' : 'toast-success'}`;
    
    const icon = type === 'error' ? 'fa-circle-xmark' : type === 'info' ? 'fa-circle-info' : 'fa-circle-check';
    toast.innerHTML = `<i class="fa-solid ${icon} text-lg"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- Auth UI Logic ---
const togglePwdBtn = document.getElementById('btn-toggle-pwd');
if(togglePwdBtn) {
    togglePwdBtn.addEventListener('click', () => {
        const pwdInput = document.getElementById('auth-password');
        const iconPwd = document.getElementById('icon-pwd');
        if (pwdInput.type === 'password') {
            pwdInput.type = 'text';
            iconPwd.classList.remove('fa-eye');
            iconPwd.classList.add('fa-eye-slash');
        } else {
            pwdInput.type = 'password';
            iconPwd.classList.remove('fa-eye-slash');
            iconPwd.classList.add('fa-eye');
        }
    });
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('btn-login');
    const errDiv = document.getElementById('login-error');
    
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    btn.disabled = true;
    errDiv.classList.add('hidden');
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will handle the UI transition
    } catch (error) {
        console.error("Login Error:", error);
        btn.innerHTML = 'Ingresar <i class="fa-solid fa-arrow-right"></i>';
        btn.disabled = false;
        errDiv.classList.remove('hidden');
        errDiv.innerText = 'Credenciales incorrectas o usuario no encontrado.';
    }
});

document.getElementById('btn-forgot-password').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    if (!email) {
        showToast("Por favor, ingresa tu correo primero.", "error");
        return;
    }
    try {
        await auth.sendPasswordResetEmail(email);
        showToast("Enlace de recuperaci&oacute;n enviado a tu correo.", "success");
    } catch (error) {
        console.error("Reset Password Error:", error);
        showToast("Error al enviar enlace. Verifica el correo.", "error");
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    auth.signOut();
});

// --- Auth State Observer ---
auth.onAuthStateChanged(async (user) => {
    const loader = document.getElementById('global-loader');
    
    if (user) {
        currentUser = user;
        document.getElementById('user-display').innerText = user.email;
        
        // Fetch user role
        try {
            const roleDoc = await db.collection("Seguridad_Roles").doc(user.uid).get();
            if (roleDoc.exists) {
                userRole = roleDoc.data().rol || 'auxiliar';
            } else {
                userRole = 'admin'; 
                await db.collection("Seguridad_Roles").doc(user.uid).set({ rol: 'admin', email: user.email });
            }
        } catch (e) {
            console.error("Error fetching role:", e);
        }
        
        // Setup UI based on Role
        document.getElementById('user-role-display').innerText = userRole === 'admin' ? 'Administrador' : 'Auxiliar';
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(el => {
            if (userRole === 'admin') {
                el.classList.remove('hidden-view');
            } else {
                el.classList.add('hidden-view');
            }
        });
        
        // Iniciar listeners de la base de datos ahora que estamos autenticados
        if(typeof initDataListeners === 'function') {
            initDataListeners();
        }
        
        // Switch View
        document.getElementById('auth-view').classList.add('hidden-view');
        document.getElementById('app-view').classList.remove('hidden-view');
        
        // Default Tab
        document.querySelector('[data-target="tab-pos"]').click();
    } else {
        currentUser = null;
        userRole = 'auxiliar';
        document.getElementById('app-view').classList.add('hidden-view');
        document.getElementById('auth-view').classList.remove('hidden-view');
        document.getElementById('btn-login').innerHTML = 'Ingresar <i class="fa-solid fa-arrow-right"></i>';
        document.getElementById('btn-login').disabled = false;
        document.getElementById('login-error').classList.add('hidden');
    }
    
    // Hide loader
    setTimeout(() => {
        if(loader) loader.classList.add('hidden-view');
    }, 500);
    
    // Hide loader
    setTimeout(() => {
        if(loader) loader.classList.add('hidden-view');
    }, 500);
});

// --- Tab Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.target;
        
        // Update Buttons
        document.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.remove('bg-secondary/80', 'text-white');
            b.classList.add('text-gray-300');
            b.querySelector('i').classList.remove('text-accent');
        });
        e.currentTarget.classList.add('bg-secondary/80', 'text-white');
        e.currentTarget.classList.remove('text-gray-300');
        e.currentTarget.querySelector('i').classList.add('text-accent');
        
        // Update Title
        document.getElementById('top-title').innerText = e.currentTarget.querySelector('span').innerText;
        
        // Update Views
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden-view'));
        document.getElementById(targetId).classList.remove('hidden-view');
        
        // Refrescar el dashboard al entrar a Reportes (renderDashboard no hace nada mientras el tab está oculto)
        if (targetId === 'tab-reports' && typeof renderDashboard === 'function') renderDashboard();
        
        // Mobile Sidebar Close
        if (window.innerWidth < 768) {
            document.getElementById('sidebar').classList.add('-translate-x-full');
            document.getElementById('sidebar-overlay').classList.add('hidden');
        }
    });
});

// Mobile Menu Toggle
document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.remove('hidden');
});

document.getElementById('sidebar-overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
});

// --- Audit Logger ---
// Centralized function to log changes without redundancy
window.logAuditChange = async (modulo, accion, documentoId, detalles) => {
    if (!currentUser) return;
    try {
        await db.collection("Historial_Cambios").add({
            Usuario: currentUser.email,
            Fecha: new Date().toISOString(),
            Modulo: modulo,
            Accion: accion,
            DocumentoID: documentoId,
            Detalles: detalles
        });
    } catch (e) {
        console.error("Error logging audit:", e);
    }
};

// Make db, storage, etc available globally for console debugging
window.omniDB = db;
window.omniAuth = auth;
window.omniStorage = storage;

// ==========================================
// M&Oacute;DULO DE INVENTARIO Y PRODUCTOS
// ==========================================

// Previsualizaci&oacute;n de Imagen
const prodImgInput = document.getElementById('prod-img');
const prodImgPreview = document.getElementById('prod-img-preview');
const prodImgPlaceholder = document.getElementById('prod-img-placeholder');
let currentImageBase64 = null;

// Funci&oacute;n para comprimir imagen usando Canvas
function compressImage(file, maxSize = 500) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Convertir a JPEG comprimido
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

if(prodImgInput) {
    prodImgInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (file) {
            // Mostrar estado de carga visual
            prodImgPlaceholder.querySelector('span').innerText = "Comprimiendo...";
            
            // Comprimir imagen y obtener Base64
            currentImageBase64 = await compressImage(file);
            
            // Mostrar previsualizaci&oacute;n
            prodImgPreview.src = currentImageBase64;
            prodImgPreview.classList.remove('hidden');
            prodImgPlaceholder.classList.add('hidden');
            
            // Restaurar texto
            prodImgPlaceholder.querySelector('span').innerText = "Subir imagen";
        }
    });
}

// Limpiar Modal de Producto
window.resetProductModal = () => {
    document.getElementById('form-producto').reset();
    document.getElementById('prod-id').value = '';
    currentImageBase64 = null;
    if(prodImgPreview) {
        prodImgPreview.src = '';
        prodImgPreview.classList.add('hidden');
    }
    if(prodImgPlaceholder) prodImgPlaceholder.classList.remove('hidden');
    document.getElementById('mod-prod-title').innerText = "Nuevo Producto";
};

// Modificamos el closeModal gen&eacute;rico para que limpie el form si es el de producto
const originalCloseModal = window.closeModal;
window.closeModal = (id) => {
    originalCloseModal(id);
    if(id === 'mod-producto') setTimeout(resetProductModal, 300);
};

// Guardar Producto (Crear / Editar)
const btnSaveProd = document.getElementById('btn-save-prod');
if(btnSaveProd) {
    btnSaveProd.addEventListener('click', async () => {
        const id = document.getElementById('prod-id').value;
        const nombre = document.getElementById('prod-nombre').value.trim();
        const cat = document.getElementById('prod-cat').value;
        const costo = Number(document.getElementById('prod-costo').value || 0);
        const precio = Number(document.getElementById('prod-precio').value || 0);
        const stock = Number(document.getElementById('prod-stock').value || 0);
        const alerta = Number(document.getElementById('prod-alerta').value || 0);
        
        // Proveedor
        const provNombre = document.getElementById('prod-prov-nombre').value.trim();
        const provTel = document.getElementById('prod-prov-tel').value.trim();
        const provCorreo = document.getElementById('prod-prov-correo').value.trim();

        if(!nombre || !precio || stock < 0) {
            showToast("Por favor completa los campos obligatorios (*)", "error");
            return;
        }

        btnSaveProd.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
        btnSaveProd.disabled = true;

        try {
            const isEdit = !!id;
            const docId = isEdit ? id : db.collection("Productos").doc().id;
            let imageUrl = null;

            // 1. Usar imagen comprimida si existe una nueva
            if (currentImageBase64) {
                imageUrl = currentImageBase64;
            }

            showToast("Guardando datos en la base de datos...", "info");
            
            // 2. Preparar Datos
            const productData = {
                id: docId,
                nombre,
                categoria: cat,
                costo_compra: costo,
                precio_venta: precio,
                stock: stock,
                alerta_minimo: alerta,
                proveedor_nombre: provNombre,
                proveedor_tel: provTel,
                proveedor_correo: provCorreo,
                ultima_actualizacion: new Date().toISOString()
            };

            // Solo actualizar la imagen si se subi&oacute; una nueva
            if (imageUrl) productData.imagen_url = imageUrl;

            // 3. Guardar en Firestore
            await db.collection("Productos").doc(docId).set(productData, { merge: true });

            showToast("Registrando en historial de auditor&iacute;a...", "info");

            // 4. Registro de Gasto Autom&aacute;tico
            let stockDiff = stock;
            if (isEdit) {
                const p = productosGlobal.find(x => x.id === docId);
                if (p) stockDiff = stock - (p.stock || 0);
            }
            if (stockDiff > 0 && costo > 0) {
                const montoGasto = stockDiff * costo;
                const newGasto = {
                    fecha: new Date().toISOString(),
                    tipo: 'Compra Inventario',
                    concepto: `Ingreso de ${stockDiff} uds de ${nombre}`,
                    monto: montoGasto,
                    usuario: window.currentUser?.email || 'Sistema',
                    id_usuario: window.currentUser?.uid || 'Sistema'
                };
                await db.collection("Gastos").add(newGasto);
            }

            // 5. Registro de Auditor&iacute;a (Solo guardamos el Delta)
            const accion = isEdit ? 'Edici&oacute;n de Producto' : 'Creaci&oacute;n de Producto';
            await logAuditChange('Inventario', accion, docId, `${accion}: ${nombre} (Stock: ${stock}, Precio: Q${precio})`);

            showToast(isEdit ? "Producto Actualizado" : "Producto Creado", "success");
            closeModal('mod-producto');

        } catch (error) {
            console.error("Error saving product:", error);
            showToast("Error: " + (error.message || "Error al guardar"), "error");
        } finally {
            btnSaveProd.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Producto';
            btnSaveProd.disabled = false;
        }
    });
}

// Listar Productos en Tiempo Real
let productosGlobal = [];
let listenersIniciados = false;
let unsubProductos = null;
let unsubCategorias = null;
let unsubGastos = null;
let unsubAuditoria = null;
let unsubUsuarios = null;

window.initDataListeners = () => {
    if(listenersIniciados) return;
    listenersIniciados = true;
    
    unsubProductos = db.collection("Productos").onSnapshot((snapshot) => {
        productosGlobal = [];
        snapshot.forEach(doc => {
            productosGlobal.push({ id: doc.id, ...doc.data() });
        });
        renderInventario();
        if(typeof renderPOSProducts === 'function') renderPOSProducts();
    }, e => console.error("Error productos:", e));

    if(typeof initCategoriasListener === 'function') initCategoriasListener();
    if(typeof initGastosListener === 'function') initGastosListener();
    if(typeof initAuditoriaListener === 'function') initAuditoriaListener();
    if(typeof initUsuariosListener === 'function') initUsuariosListener();
    if(typeof initVentasListener === 'function') initVentasListener();
    if(typeof initConfiguracionListener === 'function') initConfiguracionListener();
};

// ==========================================
// M&Oacute;DULO DE CATEGOR&Iacute;AS
// ==========================================

let categoriasGlobal = [];
let gastosGlobal = [];
window.initCategoriasListener = () => {
    unsubCategorias = db.collection("Categorias").onSnapshot(snapshot => {
        try {
            categoriasGlobal = [];
            snapshot.forEach(doc => {
                categoriasGlobal.push({ id: doc.id, ...doc.data() });
            });
            // Ordenar alfab&eacute;ticamente protegiendo contra nombres indefinidos
            categoriasGlobal.sort((a,b) => String(a.nombre || "").localeCompare(String(b.nombre || "")));
            renderCategorias();
        } catch (error) {
            console.error("Error procesando categor&iacute;as:", error);
        }
    }, error => {
        console.error("Error de Firebase en Categorias:", error);
    });
};

function renderCategorias() {
    // Render list in modal
    const lst = document.getElementById('lst-categorias');
    if (lst) {
        lst.innerHTML = '';
        if (categoriasGlobal.length === 0) {
            lst.innerHTML = '<div class="text-center text-gray-400 py-4 text-sm">No hay categor&iacute;as</div>';
        } else {
            categoriasGlobal.forEach(c => {
                lst.innerHTML += `
                    <div class="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm mb-2">
                        <span class="font-bold text-gray-700">${c.nombre}</span>
                        <div class="flex gap-2 text-sm">
                            <button onclick="editCategoria('${c.id}', '${c.nombre}')" class="text-blue-500 hover:text-blue-700 transition-colors p-1" title="Editar">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="deleteCategoria('${c.id}', '${c.nombre}')" class="text-gray-400 hover:text-red-500 transition-colors p-1" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
        }
    }
    
    // Update select in product modal
    const select = document.getElementById('prod-cat');
    if (select) {
        const val = select.value; // Guardar valor actual si existe
        select.innerHTML = '<option value="">Sin Categor&iacute;a</option>';
        categoriasGlobal.forEach(c => {
            select.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`;
        });
        if (val) select.value = val;
    }
}

window.addCategoria = async () => {
    const input = document.getElementById('nueva-cat');
    const nombre = input.value.trim();
    if (!nombre) return;
    
    // Check if exists (case insensitive)
    if (categoriasGlobal.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
        showToast("La categor&iacute;a ya existe", "error");
        return;
    }
    
    try {
        const docId = db.collection("Categorias").doc().id;
        await db.collection("Categorias").doc(docId).set({
            nombre: nombre
        });
        await logAuditChange('Inventario', 'Nueva Categor&iacute;a', docId, `Creada categor&iacute;a: ${nombre}`);
        input.value = '';
        showToast("Categor&iacute;a a&ntilde;adida");
    } catch (e) {
        console.error(e);
        showToast("Error al a&ntilde;adir", "error");
    }
};

window.editCategoria = async (id, currentName) => {
    const nuevoNombre = prompt("Editar nombre de la categor&iacute;a:", currentName);
    if (!nuevoNombre || nuevoNombre.trim() === currentName) return;
    
    const nombre = nuevoNombre.trim();
    
    if (categoriasGlobal.find(c => c.id !== id && c.nombre.toLowerCase() === nombre.toLowerCase())) {
        showToast("Ya existe otra categor&iacute;a con ese nombre", "error");
        return;
    }
    
    try {
        await db.collection("Categorias").doc(id).update({
            nombre: nombre
        });
        await logAuditChange('Inventario', 'Editar Categor&iacute;a', id, `Categor&iacute;a renombrada de ${currentName} a ${nombre}`);
        showToast("Categor&iacute;a actualizada", "success");
    } catch (e) {
        console.error(e);
        showToast("Error al actualizar", "error");
    }
};

window.deleteCategoria = async (id, nombre) => {
    if(confirm(`&iquest;Eliminar la categor&iacute;a "${nombre}"?`)) {
        try {
            await db.collection("Categorias").doc(id).delete();
            await logAuditChange('Inventario', 'Eliminar Categor&iacute;a', id, `Eliminada categor&iacute;a: ${nombre}`);
            showToast("Categor&iacute;a eliminada", "success");
        } catch (e) {
            console.error(e);
            showToast("Error al eliminar", "error");
        }
    }
};

// ==========================================
// M&Oacute;DULO DE PUNTO DE VENTA (POS)
// ==========================================

let cart = [];
let posTotal = 0;

window.renderPOSProducts = () => {
    const grid = document.getElementById('pos-grid');
    if (!grid) return;
    
    const term = (document.getElementById('srch-pos')?.value || '').toLowerCase();
    
    const filtered = productosGlobal.filter(p => 
        p.stock > 0 && // Solo productos con stock
        (p.nombre.toLowerCase().includes(term) || (p.categoria && p.categoria.toLowerCase().includes(term)))
    );
    
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10">No hay productos disponibles</div>`;
        return;
    }
    
    filtered.forEach(p => {
        const imgHtml = p.imagen_url 
            ? `<img src="${p.imagen_url}" class="w-full h-32 object-cover">`
            : `<div class="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-300 text-3xl"><i class="fa-solid fa-box"></i></div>`;
            
        grid.innerHTML += `
            <div onclick="addToCart('${p.id}')" class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md cursor-pointer transition-shadow group">
                ${imgHtml}
                <div class="p-3">
                    <p class="text-xs text-gray-400 mb-1 truncate">${p.categoria || 'General'}</p>
                    <h4 class="font-bold text-gray-800 text-sm leading-tight mb-2 group-hover:text-accent transition-colors line-clamp-2 h-10">${p.nombre}</h4>
                    <div class="flex justify-between items-center">
                        <span class="font-black text-primary">Q${p.precio_venta.toFixed(2)}</span>
                        <span class="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 font-medium">${p.stock} disp.</span>
                    </div>
                </div>
            </div>
        `;
    });
};

document.getElementById('srch-pos')?.addEventListener('input', renderPOSProducts);

window.addToCart = (id) => {
    const p = productosGlobal.find(x => x.id === id);
    if (!p || p.stock <= 0) return;
    
    const existing = cart.find(item => item.id === id);
    if (existing) {
        if (existing.qty < p.stock) {
            existing.qty++;
        } else {
            showToast("No hay m&aacute;s stock disponible", "error");
        }
    } else {
        cart.push({
            id: p.id,
            nombre: p.nombre,
            precio: p.precio_venta,
            qty: 1,
            maxStock: p.stock
        });
    }
    renderCart();
};

window.removeFromCart = (id) => {
    const index = cart.findIndex(item => item.id === id);
    if (index > -1) {
        if (cart[index].qty > 1) {
            cart[index].qty--;
        } else {
            cart.splice(index, 1);
        }
        renderCart();
    }
};

window.deleteFromCart = (id) => {
    cart = cart.filter(item => item.id !== id);
    renderCart();
};

window.clearCart = () => {
    if(cart.length === 0) return;
    if(confirm('&iquest;Seguro que deseas vaciar el carrito?')) {
        cart = [];
        renderCart();
    }
};

window.renderCart = () => {
    const container = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    const totalEl = document.getElementById('cart-total');
    const btnCobrar = document.getElementById('btn-cobrar');
    
    if (!container) return;
    
    container.innerHTML = '';
    posTotal = 0;
    
    if (cart.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-10 text-sm">
                <i class="fa-solid fa-cart-arrow-down text-3xl mb-2 text-gray-300"></i>
                <p>El carrito est&aacute; vac&iacute;o</p>
            </div>
        `;
        subtotalEl.innerText = 'Q0.00';
        totalEl.innerText = 'Q0.00';
        btnCobrar.disabled = true;
        return;
    }
    
    cart.forEach(item => {
        const sub = item.precio * item.qty;
        posTotal += sub;
        
        container.innerHTML += `
            <div class="bg-white p-3 rounded-lg shadow-sm border border-gray-100 mb-2 flex flex-col gap-2">
                <div class="flex justify-between items-start">
                    <span class="font-bold text-gray-800 text-sm leading-tight flex-1 pr-2">${item.nombre}</span>
                    <button onclick="deleteFromCart('${item.id}')" class="text-gray-400 hover:text-red-500"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-accent font-bold text-sm">Q${item.precio.toFixed(2)}</span>
                    <div class="flex items-center gap-3 bg-gray-50 rounded-lg p-1 border border-gray-200">
                        <button onclick="removeFromCart('${item.id}')" class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-200 rounded transition-colors"><i class="fa-solid fa-minus text-xs"></i></button>
                        <span class="font-bold text-sm w-4 text-center">${item.qty}</span>
                        <button onclick="addToCart('${item.id}')" class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-200 rounded transition-colors"><i class="fa-solid fa-plus text-xs"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
    
    subtotalEl.innerText = `Q${posTotal.toFixed(2)}`;
    totalEl.innerText = `Q${posTotal.toFixed(2)}`;
    btnCobrar.disabled = false;
};

// Cobro
window.openCobroModal = () => {
    if(cart.length === 0) return;
    document.getElementById('cobro-total').innerText = `Q${posTotal.toFixed(2)}`;
    document.getElementById('cobro-efectivo').value = '';
    document.getElementById('cobro-cambio').innerText = 'Q0.00';
    document.getElementById('btn-confirmar-pago').disabled = true;
    openModal('mod-cobro');
    setTimeout(() => document.getElementById('cobro-efectivo').focus(), 300);
};

window.calcularCambio = () => {
    const efectivo = Number(document.getElementById('cobro-efectivo').value);
    const cambio = efectivo - posTotal;
    const btn = document.getElementById('btn-confirmar-pago');
    const cambioEl = document.getElementById('cobro-cambio');
    
    if (efectivo >= posTotal) {
        cambioEl.innerText = `Q${cambio.toFixed(2)}`;
        cambioEl.classList.remove('text-red-500');
        cambioEl.classList.add('text-blue-600');
        btn.disabled = false;
    } else {
        cambioEl.innerText = 'Insuficiente';
        cambioEl.classList.add('text-red-500');
        cambioEl.classList.remove('text-blue-600');
        btn.disabled = true;
    }
};

window.procesarPago = async () => {
    const btn = document.getElementById('btn-confirmar-pago');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Procesando...';
    btn.disabled = true;
    
    try {
        const batch = db.batch();
        const ventaId = db.collection("Ventas").doc().id;
        const nit = document.getElementById('cobro-nit').value || 'CF';
        const nombre = document.getElementById('cobro-nombre').value || 'Consumidor Final';
        const direccion = document.getElementById('cobro-direccion').value || '';
        
        // 1. Crear documento de Venta
        batch.set(db.collection("Ventas").doc(ventaId), {
            id: ventaId,
            fecha: new Date().toISOString(),
            vendedor: currentUser.email,
            total: posTotal,
            efectivo: Number(document.getElementById('cobro-efectivo').value),
            nit: nit,
            nombre_cliente: nombre,
            direccion: direccion,
            items: cart.map(c => ({ id: c.id, nombre: c.nombre, precio: c.precio, cantidad: c.qty }))
        });
        
        // 2. Restar Stock de Inventario
        cart.forEach(item => {
            const prodRef = db.collection("Productos").doc(item.id);
            // Usar FieldValue.increment para operaciones at&oacute;micas ser&iacute;a ideal, pero lo haremos manualmente por compatibilidad con el entorno actual
            batch.update(prodRef, {
                stock: firebase.firestore.FieldValue.increment(-item.qty)
            });
        });
        
        await batch.commit();
        
        // 3. Auditor&iacute;a general
        await logAuditChange('Ventas', 'Nueva Venta', ventaId, `Venta por Q${posTotal.toFixed(2)} (${cart.length} art&iacute;culos)`);
        
        showToast("Venta completada exitosamente", "success");
        closeModal('mod-cobro');
        cart = [];
        renderCart();
        
    } catch (error) {
        console.error("Error al procesar pago:", error);
        showToast("Hubo un error al procesar el pago", "error");
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Pago';
        btn.disabled = false;
    }
};

// ==========================================
// M&Oacute;DULO DE VENTAS (RECIBOS)
// ==========================================

let ventasGlobal = [];

window.initVentasListener = () => {
    unsubVentas = db.collection("Ventas").orderBy("fecha", "desc").limit(100).onSnapshot(snapshot => {
        ventasGlobal = [];
        snapshot.forEach(doc => {
            ventasGlobal.push(doc.data());
        });
        renderVentas();
        if(typeof renderDashboard === 'function') renderDashboard();
    }, error => {
        console.error("Error de Firebase en Ventas:", error);
    });
};

window.renderVentas = () => {
    const tbody = document.getElementById('tbl-ventas');
    if(!tbody) return;
    
    const term = (document.getElementById('srch-ventas')?.value || '').toLowerCase();
    
    const filtered = ventasGlobal.filter(v => 
        (v.nombre_cliente && v.nombre_cliente.toLowerCase().includes(term)) ||
        (v.nit && v.nit.toLowerCase().includes(term)) ||
        (v.vendedor && v.vendedor.toLowerCase().includes(term)) ||
        (v.id && v.id.toLowerCase().includes(term))
    );
    
    tbody.innerHTML = '';
    
    if(filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400">No hay ventas registradas</td></tr>';
        return;
    }
    
    filtered.forEach(v => {
        const d = new Date(v.fecha);
        const fechaStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        tbody.innerHTML += `
            <tr class="hover:bg-gray-50/50 transition-colors">
                <td class="p-4 align-middle font-medium text-gray-700">${fechaStr}</td>
                <td class="p-4 align-middle text-gray-600">${v.nombre_cliente || '-'}</td>
                <td class="p-4 align-middle text-gray-600">${v.nit || '-'}</td>
                <td class="p-4 align-middle text-gray-500 text-sm">${v.vendedor}</td>
                <td class="p-4 align-middle text-right font-bold text-accent">Q${v.total.toFixed(2)}</td>
                <td class="p-4 align-middle text-center">
                    <button onclick="openReciboModal('${v.id}')" class="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary/90 transition-colors">
                        <i class="fa-solid fa-eye"></i> Recibo
                    </button>
                </td>
            </tr>
        `;
    });
};

window.openReciboModal = (ventaId) => {
    const venta = ventasGlobal.find(v => v.id === ventaId);
    if(!venta) return;
    
    const content = document.getElementById('ticket-content');
    const d = new Date(venta.fecha);
    
    let html = `
        <div class="text-center mb-4 border-b border-dashed border-gray-300 pb-4">
            ${globalConfig.logo_b64 ? `<img src="${globalConfig.logo_b64}" class="w-16 h-16 mx-auto object-cover rounded-lg mb-2">` : ''}
            <h2 class="text-xl font-bold uppercase tracking-widest mb-1">${globalConfig.nombre_tienda}</h2>
            <p class="text-xs text-gray-500">Comprobante de Venta</p>
        </div>
        <div class="mb-4 text-xs space-y-1">
            <p><strong>Fecha:</strong> ${d.toLocaleDateString()} ${d.toLocaleTimeString()}</p>
            <p><strong>Recibo #:</strong> ${venta.id.substring(0,8)}</p>
            <p><strong>Vendedor:</strong> ${venta.vendedor}</p>
        </div>
        <div class="mb-4 text-xs space-y-1 bg-gray-50 p-2 rounded border border-gray-200">
            <p><strong>Cliente:</strong> ${venta.nombre_cliente}</p>
            <p><strong>NIT/CF:</strong> ${venta.nit}</p>
            ${venta.direccion ? `<p><strong>Dir:</strong> ${venta.direccion}</p>` : ''}
        </div>
        <table class="w-full text-xs mb-4">
            <tr class="border-b border-dashed border-gray-300">
                <th class="text-left pb-1">Cant</th>
                <th class="text-left pb-1">Desc</th>
                <th class="text-right pb-1">Monto</th>
            </tr>
    `;
    
    venta.items.forEach(i => {
        html += `
            <tr>
                <td class="py-1 align-top">${i.cantidad}</td>
                <td class="py-1 align-top pr-2">${i.nombre}</td>
                <td class="py-1 text-right align-top">Q${(i.precio * i.cantidad).toFixed(2)}</td>
            </tr>
        `;
    });
    
    html += `
        </table>
        <div class="border-t border-dashed border-gray-300 pt-3 space-y-1 text-right">
            <p class="text-lg font-bold">TOTAL: Q${venta.total.toFixed(2)}</p>
            <p class="text-xs text-gray-500">Efectivo: Q${(venta.efectivo || venta.total).toFixed(2)}</p>
            <p class="text-xs text-gray-500">Cambio: Q${((venta.efectivo || venta.total) - venta.total).toFixed(2)}</p>
        </div>
        <div class="mt-6 text-center text-xs text-gray-500">
            <p>&iexcl;Gracias por su compra!</p>
        </div>
    `;
    
    content.innerHTML = html;
    openModal('mod-recibo');
};

window.imprimirRecibo = () => {
    const content = document.getElementById('ticket-content').innerHTML;
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
        <html>
            <head>
                <title>Recibo</title>
                <style>
                    body { font-family: monospace; padding: 20px; font-size: 14px; color: #000; }
                    .text-center { text-align: center; }
                    .mb-4 { margin-bottom: 1rem; }
                    .text-xl { font-size: 1.5rem; }
                    .font-bold { font-weight: bold; }
                    .border-b { border-bottom: 1px dashed #ccc; }
                    .pb-4 { padding-bottom: 1rem; }
                    .w-full { width: 100%; }
                    .text-left { text-align: left; }
                    .text-right { text-align: right; }
                    table { border-collapse: collapse; margin-bottom: 1rem; }
                    th, td { padding: 4px 0; }
                    .border-t { border-top: 1px dashed #ccc; }
                    .pt-3 { padding-top: 0.75rem; }
                    .text-lg { font-size: 1.25rem; }
                    .mt-6 { margin-top: 1.5rem; }
                </style>
            </head>
            <body>
                ${content}
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
};

// ==========================================
// M&Oacute;DULO DE AUDITOR&Iacute;A (ADMIN ONLY)
// ==========================================

let logsAuditoria = [];

window.initAuditoriaListener = () => {
    unsubAuditoria = db.collection("Historial_Cambios").orderBy("fecha", "desc").limit(100).onSnapshot(snapshot => {
        logsAuditoria = [];
        snapshot.forEach(doc => {
            logsAuditoria.push(doc.data());
        });
        renderAuditoria();
    });
};

function renderAuditoria() {
    const tbody = document.getElementById('tbl-auditoria');
    if(!tbody) return;
    
    const term = (document.getElementById('srch-audit')?.value || '').toLowerCase();
    
    const filtered = logsAuditoria.filter(log => 
        (log.Modulo || '').toLowerCase().includes(term) ||
        (log.Accion || '').toLowerCase().includes(term) ||
        (log.Usuario || '').toLowerCase().includes(term) ||
        (log.Detalles || '').toLowerCase().includes(term)
    );
    
    tbody.innerHTML = '';
    
    if(filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">No se encontraron registros</td></tr>';
        return;
    }
    
    filtered.forEach(log => {
        const dateObj = new Date(log.Fecha);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
        
        // Color coding for modules
        let moduleColor = 'bg-gray-100 text-gray-700';
        if (log.Modulo === 'Inventario') moduleColor = 'bg-blue-100 text-blue-700';
        else if (log.Modulo === 'Ventas') moduleColor = 'bg-green-100 text-green-700';
        else if (log.Modulo === 'Seguridad') moduleColor = 'bg-purple-100 text-purple-700';

        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
                <td class="p-4 text-gray-500 whitespace-nowrap">${dateStr}</td>
                <td class="p-4 font-medium text-gray-700">${log.Usuario}</td>
                <td class="p-4"><span class="${moduleColor} px-2 py-1 rounded text-xs font-bold">${log.Modulo}</span></td>
                <td class="p-4 text-gray-800">${log.Accion}</td>
                <td class="p-4 text-gray-600 text-xs">${log.Detalles}</td>
            </tr>
        `;
    });
}

document.getElementById('srch-audit')?.addEventListener('input', renderAuditoria);

// ==========================================
// M&Oacute;DULO DE USUARIOS Y ROLES (ADMIN ONLY)
// ==========================================

let secondaryApp = null;
let secondaryAuth = null;
let usuariosGlobal = [];

// Inicializar la app secundaria para creaci&oacute;n de usuarios sin cerrar sesi&oacute;n
if (!firebase.apps.length || firebase.apps.length === 1) {
    secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
    secondaryAuth = secondaryApp.auth();
}

window.initUsuariosListener = () => {
    unsubUsuarios = db.collection("Seguridad_Roles").onSnapshot(snapshot => {
        usuariosGlobal = [];
        snapshot.forEach(doc => {
            usuariosGlobal.push({ id: doc.uid || doc.id, ...doc.data() });
        });
        renderUsuarios();
    });
};

function renderUsuarios() {
    const tbody = document.getElementById('tbl-usuarios');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    if(usuariosGlobal.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-gray-400">No hay usuarios</td></tr>';
        return;
    }
    
    usuariosGlobal.forEach(u => {
        const roleBadge = u.rol === 'admin' 
            ? '<span class="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">Administrador</span>'
            : '<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Auxiliar</span>';
            
        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
                <td class="p-4 font-medium text-gray-700">${u.email}</td>
                <td class="p-4">${roleBadge}</td>
                <td class="p-4 text-center">
                    <button class="text-gray-400 hover:text-red-500 transition-colors p-2" title="Revocar Acceso (Eliminar Rol)" onclick="eliminarRol('${u.id}', '${u.email}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

window.eliminarRol = async (uid, email) => {
    if(confirm(`&iquest;Est&aacute;s seguro de quitarle el acceso a ${email}? (Esto no borra su cuenta de Firebase, pero le impide entrar al sistema)`)) {
        try {
            await db.collection("Seguridad_Roles").doc(uid).delete();
            await logAuditChange('Seguridad', 'Eliminaci&oacute;n de Rol', uid, `Se revoc&oacute; acceso a: ${email}`);
            showToast("Acceso revocado", "success");
        } catch (e) {
            console.error(e);
            showToast("Error al revocar", "error");
        }
    }
}

// Crear Usuario (Workaround sin backend)
const btnSaveUsr = document.getElementById('btn-save-usr');
if (btnSaveUsr) {
    btnSaveUsr.addEventListener('click', async () => {
        const email = document.getElementById('usr-email').value.trim();
        const pass = document.getElementById('usr-pass').value;
        const rol = document.getElementById('usr-rol').value;
        
        if(!email || pass.length < 6) {
            showToast("El correo es requerido y la contrase&ntilde;a debe tener al menos 6 caracteres", "error");
            return;
        }
        
        btnSaveUsr.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creando...';
        btnSaveUsr.disabled = true;
        
        try {
            // Inicializar App Secundaria para evitar que cierre la sesi&oacute;n del Admin actual
            const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
            const res = await secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
            
            // Asignar el rol en Firestore
            await db.collection("Seguridad_Roles").doc(res.user.uid).set({
                email: email,
                rol: rol
            });
            
            // Cerrar sesi&oacute;n y eliminar app secundaria
            await secondaryApp.auth().signOut();
            await secondaryApp.delete();
            
            await logAuditChange('Seguridad', 'Nuevo Usuario', res.user.uid, `Creado el usuario ${email} con rol: ${rol}`);
            
            showToast("Empleado creado exitosamente");
            closeModal('mod-usuario');
            document.getElementById('form-usuario').reset();
            
        } catch (error) {
            console.error("Error creating user:", error);
            showToast("Error al crear usuario (Revisa que el correo no exista ya)", "error");
        } finally {
            btnSaveUsr.innerHTML = '<i class="fa-solid fa-check"></i> Crear Usuario';
            btnSaveUsr.disabled = false;
        }
    });
}

// ==========================================
// M&Oacute;DULO DE CONFIGURACI&Oacute;N (GLOBAL)
// ==========================================



window.initConfiguracionListener = () => {
    db.collection("Configuracion").doc("global").onSnapshot(doc => {
        if(doc.exists) {
            const data = doc.data();
            globalConfig = { ...globalConfig, ...data };
        }
        aplicarConfiguracionUI();
    }, error => {
        console.error("Error al cargar configuraci&oacute;n:", error);
    });
};

function aplicarConfiguracionUI() {
    // Aplicar colores CSS Variables
    document.documentElement.style.setProperty('--color-primary', globalConfig.color_primary);
    document.documentElement.style.setProperty('--color-secondary', globalConfig.color_primary); // Usamos primary como base
    document.documentElement.style.setProperty('--color-accent', globalConfig.color_accent);
    document.documentElement.style.setProperty('--color-accent-hover', globalConfig.color_accent);
    
    // Aplicar Nombre
    const tituloElements = document.querySelectorAll('.app-title-display');
    tituloElements.forEach(el => el.innerText = globalConfig.nombre_tienda);
    document.title = globalConfig.nombre_tienda + " - Punto de Venta";
    
    // Aplicar Logo en UI
    const logos = document.querySelectorAll('.app-logo-display');
    logos.forEach(img => {
        if(globalConfig.logo_b64) {
            img.src = globalConfig.logo_b64;
            img.classList.remove('hidden');
        } else {
            img.classList.add('hidden');
        }
    });

    // Cargar en el form de config
    const iptNombre = document.getElementById('conf-nombre');
    const iptColorP = document.getElementById('conf-color-primary');
    const iptColorA = document.getElementById('conf-color-accent');
    
    if(iptNombre) iptNombre.value = globalConfig.nombre_tienda;
    if(iptColorP) {
        iptColorP.value = globalConfig.color_primary;
        document.getElementById('conf-color-primary-val').textContent = globalConfig.color_primary;
    }
    if(iptColorA) {
        iptColorA.value = globalConfig.color_accent;
        document.getElementById('conf-color-accent-val').textContent = globalConfig.color_accent;
    }
    
    // Guardar en LocalStorage para tematizar antes del login
    localStorage.setItem('omnipos_config', JSON.stringify(globalConfig));
    
    if(globalConfig.logo_b64) {
        const preview = document.getElementById('conf-logo-preview');
        const icon = document.getElementById('conf-logo-icon');
        if(preview && icon) {
            preview.src = globalConfig.logo_b64;
            preview.classList.remove('hidden');
            icon.classList.add('hidden');
        }
    }
}

// Preview Logo
const confLogoInput = document.getElementById('conf-logo');
let tempConfLogoB64 = null;

if(confLogoInput) {
    confLogoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        const preview = document.getElementById('conf-logo-preview');
        const icon = document.getElementById('conf-logo-icon');
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.src = ev.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300;
                const MAX_HEIGHT = 300;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                  if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                  }
                } else {
                  if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                  }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                tempConfLogoB64 = canvas.toDataURL('image/jpeg', 0.8);
                preview.src = tempConfLogoB64;
                preview.classList.remove('hidden');
                icon.classList.add('hidden');
            };
        };
        reader.readAsDataURL(file);
    });
}

// Update color value text
document.getElementById('conf-color-primary')?.addEventListener('input', (e) => {
    document.getElementById('conf-color-primary-val').innerText = e.target.value.toUpperCase();
});
document.getElementById('conf-color-accent')?.addEventListener('input', (e) => {
    document.getElementById('conf-color-accent-val').innerText = e.target.value.toUpperCase();
});

window.guardarConfiguracion = async () => {
    const btn = document.getElementById('btn-save-config');
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Guardando...';
    btn.disabled = true;
    
    const nombre = document.getElementById('conf-nombre').value.trim() || 'OmniPOS';
    const colorP = document.getElementById('conf-color-primary').value;
    const colorA = document.getElementById('conf-color-accent').value;
    
    try {
        await db.collection("Configuracion").doc("global").set({
            nombre_tienda: nombre,
            color_primary: colorP,
            color_accent: colorA,
            logo_b64: tempConfLogoB64 || globalConfig.logo_b64
        }, { merge: true });
        
        showToast("Configuraci&oacute;n guardada", "success");
        await logAuditChange("Configuraci&oacute;n", "Actualizaci&oacute;n General", "global", "Se actualiz&oacute; la configuraci&oacute;n visual de la tienda.");
    } catch (e) {
        console.error("Error guardando config:", e);
        showToast("Error al guardar", "error");
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
        btn.disabled = false;
    }
};

// ==========================================
// M&Oacute;DULO DE DASHBOARD / REPORTES
// ==========================================
let mainChart = null;
let currentDashFilter = "mes";

window.setDashFilter = (filter) => {
    currentDashFilter = filter;
    
    document.querySelectorAll(".dash-flt").forEach(btn => {
        btn.classList.remove("bg-white", "shadow", "text-primary");
        btn.classList.add("text-gray-500");
    });
    
    const activeBtn = document.getElementById(`btn-dash-${filter}`);
    if (activeBtn) {
        activeBtn.classList.remove("text-gray-500");
        activeBtn.classList.add("bg-white", "shadow", "text-primary");
    }
    
    renderDashboard();
};

window.renderDashboard = () => {
    const tabReports = document.getElementById("tab-reports");
    if (!tabReports || tabReports.classList.contains("hidden-view")) return;

    const now = new Date();
    let startDate = new Date();
    
    let lblText = "Este Mes";
    if (currentDashFilter === "hoy") {
        startDate.setHours(0,0,0,0);
        lblText = "Hoy";
    } else if (currentDashFilter === "semana") {
        startDate.setDate(now.getDate() - 7);
        lblText = "&Uacute;ltimos 7 d&iacute;as";
    } else {
        startDate.setDate(now.getDate() - 30);
    }
    
    document.querySelectorAll(".dash-lbl-period").forEach(el => el.textContent = lblText);
    
    const ventasFiltradas = ventasGlobal.filter(v => new Date(v.fecha) >= startDate.getTime());
    const gastosFiltrados = gastosGlobal.filter(g => new Date(g.fecha) >= startDate.getTime());
    
    const ventasTotales = ventasFiltradas.reduce((sum, v) => sum + v.total, 0);
    const gastosTotales = gastosFiltrados.reduce((sum, g) => sum + g.monto, 0);
    const utilidadNeta = ventasTotales - gastosTotales;
    
    document.getElementById("kpi-ventas").textContent = `Q${ventasTotales.toFixed(2)}`;
    document.getElementById("kpi-gastos").textContent = `Q${gastosTotales.toFixed(2)}`;
    document.getElementById("kpi-utilidad").textContent = `Q${utilidadNeta.toFixed(2)}`;
    
    let productCounts = {};
    ventasFiltradas.forEach(v => {
        if(v.items) {
            v.items.forEach(item => {
                if(!productCounts[item.id]) {
                    productCounts[item.id] = { name: item.nombre, qty: 0, revenue: 0 };
                }
                productCounts[item.id].qty += item.cantidad;
                productCounts[item.id].revenue += (item.precio * item.cantidad);
            });
        }
    });
    
    const top5 = Object.values(productCounts)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
        
    const topContainer = document.getElementById("dash-top5");
    if (top5.length === 0) {
        topContainer.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400 text-sm">No hay datos suficientes</div>`;
    } else {
        topContainer.innerHTML = top5.map((p, i) => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center text-sm">${i+1}</div>
                    <div>
                        <p class="font-bold text-sm text-gray-800 line-clamp-1">${p.name}</p>
                        <p class="text-xs text-gray-500">${p.qty} unidades vendidas</p>
                    </div>
                </div>
                <div class="font-bold text-primary">Q${p.revenue.toFixed(2)}</div>
            </div>
        `).join("");
    }
    
    
    // Alertas Bajo Stock
    const bajoContainer = document.getElementById("dash-bajo-stock");
    if (bajoContainer) {
        const bajos = productosGlobal.filter(p => p.stock <= (p.alerta_minimo || 5)).sort((a,b) => a.stock - b.stock);
        if (bajos.length === 0) {
            bajoContainer.innerHTML = `<div class="flex items-center justify-center h-full text-gray-400 text-sm">Inventario en buen estado</div>`;
        } else {
            bajoContainer.innerHTML = bajos.map(p => `
                <div class="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100 mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-red-100 text-red-500 font-bold flex items-center justify-center text-sm"><i class="fa-solid fa-triangle-exclamation"></i></div>
                        <div>
                            <p class="font-bold text-sm text-gray-800 line-clamp-1">${p.nombre}</p>
                            <p class="text-xs text-gray-500">Stock actual: ${p.stock || 0}</p>
                        </div>
                    </div>
                    <div class="font-bold text-red-500 text-xs">Faltan ${(p.alerta_minimo || 5) - (p.stock || 0) + 1}</div>
                </div>
            `).join("");
        }
    }
    
    renderChart(ventasFiltradas, currentDashFilter);

};

function renderChart(ventas, filter) {
    const ctx = document.getElementById("mainChart");
    if (!ctx) return;
    
    let grouped = {};
    ventas.forEach(v => {
        const d = new Date(v.fecha);
        let key = "";
        if (filter === "hoy") {
            key = `${d.getHours()}:00`;
        } else {
            key = `${d.getDate()}/${d.getMonth()+1}`;
        }
        if (!grouped[key]) grouped[key] = 0;
        grouped[key] += v.total;
    });
    
    let labels = [];
    if (filter === "hoy") {
        labels = Object.keys(grouped).sort((a, b) => parseInt(a) - parseInt(b));
    } else {
        labels = Object.keys(grouped).reverse();
    }
    
    let dataPoints = labels.map(l => grouped[l]);
    
    if (mainChart) mainChart.destroy();
    
    const computedStyle = getComputedStyle(document.documentElement);
    const accentColor = computedStyle.getPropertyValue("--color-accent").trim() || "#3B82F6";
    
    mainChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Ventas (Q)",
                data: dataPoints,
                borderColor: accentColor,
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: "#fff",
                pointBorderColor: accentColor,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [5, 5], color: "#f3f4f6" } },
                x: { grid: { display: false } }
            }
        }
    });
}



// ==========================================
// M&Oacute;DULO DE GASTOS Y CAJA
// ==========================================

window.initGastosListener = () => {
    unsubGastos = db.collection("Gastos").onSnapshot(snapshot => {
        gastosGlobal = [];
        snapshot.forEach(doc => gastosGlobal.push({id: doc.id, ...doc.data()}));
        renderGastos();
        renderDashboard();
    }, error => {
        console.error("Error al obtener gastos:", error);
    });
};

window.renderGastos = () => {
    const tbody = document.getElementById('tbl-gastos');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if (gastosGlobal.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">No hay gastos registrados.</td></tr>';
        return;
    }
    
    // Sort descending by date
    const sorted = [...gastosGlobal].sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
    
    sorted.forEach(g => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50/50 transition-colors';
        const formattedDate = new Date(g.fecha).toLocaleString();
        
        tr.innerHTML = `
            <td class="p-4 text-gray-500">${formattedDate}</td>
            <td class="p-4 font-medium text-gray-700">${g.tipo}</td>
            <td class="p-4">${g.concepto}</td>
            <td class="p-4">${g.usuario}</td>
            <td class="p-4 text-right font-bold text-red-600">Q${g.monto.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
};

document.getElementById('btn-save-gas')?.addEventListener('click', async () => {
    if (!currentUser) return;
    
    const tipo = document.getElementById('gas-tipo').value;
    const concepto = document.getElementById('gas-concepto').value;
    const monto = parseFloat(document.getElementById('gas-monto').value);
    
    if (!concepto || isNaN(monto) || monto <= 0) {
        showToast("Por favor complete los campos correctamente.", "error");
        return;
    }
    
    const newGasto = {
        fecha: new Date().toISOString(),
        tipo: tipo,
        concepto: concepto,
        monto: monto,
        usuario: currentUser.email || 'Admin',
        id_usuario: currentUser.uid || 'Admin'
    };
    
    try {
        await db.collection("Gastos").add(newGasto);
        logAuditChange("Finanzas", "Gasto Registrado", "N/A", `${tipo}: ${concepto} por Q${monto}`);
        showToast("Gasto registrado con &eacute;xito.");
        closeModal('mod-gasto');
        document.getElementById('form-gasto').reset();
    } catch (e) {
        console.error(e);
        showToast("Error al guardar el gasto.", "error");
    }
});

window.abrirCierreCaja = () => {
    if (!currentUser) return;
    
    // Calculate today's sales and expenses
    const today = new Date().toISOString().split('T')[0];
    
    let vEfectivo = 0;
    let vTarjeta = 0;
    
    ventasGlobal.forEach(v => {
        if(v.fecha.startsWith(today)) {
            if(v.metodo_pago === 'Efectivo') vEfectivo += v.total;
            else vTarjeta += v.total;
        }
    });
    
    let gDia = 0;
    gastosGlobal.forEach(g => {
        if(g.fecha.startsWith(today)) {
            gDia += g.monto;
        }
    });
    
    // Efectivo esperado = Ventas Efectivo - Gastos
    const esperado = vEfectivo - gDia;
    
    document.getElementById('cc-ventas-efectivo').innerText = `Q${vEfectivo.toFixed(2)}`;
    document.getElementById('cc-ventas-tarjeta').innerText = `Q${vTarjeta.toFixed(2)}`;
    document.getElementById('cc-gastos-dia').innerText = `- Q${gDia.toFixed(2)}`;
    document.getElementById('cc-esperado').innerText = `Q${esperado.toFixed(2)}`;
    
    document.getElementById('cc-esperado').dataset.val = esperado;
    document.getElementById('cc-real').value = '';
    document.getElementById('cc-notas').value = '';
    document.getElementById('cc-diferencia-box').className = 'hidden';
    
    openModal('mod-cierre');
};

window.calcCierreDiferencia = () => {
    const esperado = parseFloat(document.getElementById('cc-esperado').dataset.val || 0);
    const real = parseFloat(document.getElementById('cc-real').value || 0);
    const diffBox = document.getElementById('cc-diferencia-box');
    
    const diff = real - esperado;
    diffBox.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'bg-red-100', 'text-red-700', 'bg-blue-100', 'text-blue-700');
    
    if(diff === 0) {
        diffBox.classList.add('bg-green-100', 'text-green-700');
        diffBox.innerText = "Caja Cuadrada Exactamente";
    } else if (diff < 0) {
        diffBox.classList.add('bg-red-100', 'text-red-700');
        diffBox.innerText = `Faltante: Q${Math.abs(diff).toFixed(2)}`;
    } else {
        diffBox.classList.add('bg-blue-100', 'text-blue-700');
        diffBox.innerText = `Sobrante: Q${diff.toFixed(2)}`;
    }
};

document.getElementById('btn-save-cierre')?.addEventListener('click', async () => {
    if (!currentUser) return;
    
    const real = parseFloat(document.getElementById('cc-real').value);
    if(isNaN(real)) {
        return showToast("Ingrese el efectivo real.", "error");
    }
    
    const vEfectivo = document.getElementById('cc-ventas-efectivo').innerText;
    const vTarjeta = document.getElementById('cc-ventas-tarjeta').innerText;
    const esperado = parseFloat(document.getElementById('cc-esperado').dataset.val);
    const notas = document.getElementById('cc-notas').value;
    
    const cierre = {
        fecha: new Date().toISOString(),
        ventas_efectivo: vEfectivo,
        ventas_tarjeta: vTarjeta,
        esperado: esperado,
        real: real,
        diferencia: real - esperado,
        notas: notas,
        usuario: currentUser.email
    };
    
    try {
        await db.collection("Cierres_Caja").add(cierre);
        logAuditChange("Finanzas", "Cierre de Caja", "N/A", `Cierre realizado. Diferencia: Q${(real-esperado).toFixed(2)}`);
        showToast("Turno Finalizado Correctamente.");
        closeModal('mod-cierre');
    } catch(e) {
        showToast("Error al guardar el cierre.", "error");
    }
});

document.getElementById('srch-inv')?.addEventListener('input', () => {
    if(typeof renderInventario === 'function') renderInventario();
});

window.renderInventario = () => {
    const tbody = document.getElementById('tbl-inventario');
    const srch = document.getElementById('srch-inv');
    if (!tbody) return;
    const filter = (srch ? srch.value.toLowerCase() : '');
    
    let html = '';
    let totProd = 0;
    let totCosto = 0;
    let totIngreso = 0;

    let filtered = productosGlobal;
    if (filter) {
        filtered = productosGlobal.filter(p => 
            String(p.nombre).toLowerCase().includes(filter) || 
            String(p.categoria).toLowerCase().includes(filter)
        );
    }
    
    filtered.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));

    filtered.forEach(p => {
        totProd += (p.stock || 0);
        totCosto += (p.costo_compra || 0) * (p.stock || 0);
        totIngreso += (p.precio_venta || 0) * (p.stock || 0);

        const row = `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="p-4 flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    ${p.imagen_url ? `<img src="${p.imagen_url}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-box text-gray-400"></i>`}
                </div>
                <div>
                    <p class="font-bold text-gray-800">${p.nombre}</p>
                </div>
            </td>
            <td class="p-4 text-gray-600">${p.categoria || 'Sin Categoría'}</td>
            <td class="p-4 text-right font-mono font-medium">Q${Number(p.precio_venta || 0).toFixed(2)}</td>
            <td class="p-4 text-center">
                <span class="px-3 py-1 rounded-full text-xs font-bold ${p.stock <= (p.alerta_minimo || 5) ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}">
                    ${p.stock || 0}
                </span>
            </td>
            <td class="p-4 text-center">
                <button onclick="editProducto('${p.id}')" class="w-8 h-8 rounded-lg text-gray-400 hover:text-accent hover:bg-blue-50 transition-colors" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button onclick="deleteProducto('${p.id}')" class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-1" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>`;
        html += row;
    });

    if (filtered.length === 0) {
        html = `<tr><td colspan="5" class="p-8 text-center text-gray-400">No se encontraron productos.</td></tr>`;
    }
    tbody.innerHTML = html;

    const elTotProd = document.getElementById('inv-stat-total');
    const elTotCosto = document.getElementById('inv-stat-valor');
    const elTotIngreso = document.getElementById('inv-total-ingreso');
    if (elTotProd) elTotProd.innerText = totProd;
    if (elTotCosto) elTotCosto.innerText = 'Q' + totCosto.toFixed(2);
    if (elTotIngreso) elTotIngreso.innerText = 'Q' + totIngreso.toFixed(2);
    
    const elTotGanancia = document.getElementById('inv-total-ganancia');
    if (elTotGanancia) elTotGanancia.innerText = 'Q' + (totIngreso - totCosto).toFixed(2);
};

// --- Modal and Product Edit/Delete ---
window.openNewProductModal = () => {
    resetProductModal();
    openModal('mod-producto');
};

window.editProducto = (id) => {
    const p = productosGlobal.find(x => x.id === id);
    if (!p) return;
    document.getElementById('mod-prod-title').innerText = 'Editar Producto';
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-nombre').value = p.nombre || '';
    document.getElementById('prod-cat').value = p.categoria || '';
    document.getElementById('prod-costo').value = p.costo_compra || '';
    document.getElementById('prod-precio').value = p.precio_venta || '';
    document.getElementById('prod-stock').value = p.stock || 0;
    document.getElementById('prod-alerta').value = p.alerta_minimo || 5;
    document.getElementById('prod-prov-nombre').value = p.proveedor_nombre || '';
    document.getElementById('prod-prov-tel').value = p.proveedor_tel || '';
    document.getElementById('prod-prov-correo').value = p.proveedor_correo || '';
    
    currentImageBase64 = null;
    if (p.imagen_url) {
        prodImgPreview.src = p.imagen_url;
        prodImgPreview.classList.remove('hidden');
        prodImgPlaceholder.classList.add('hidden');
    } else {
        prodImgPreview.src = '';
        prodImgPreview.classList.add('hidden');
        prodImgPlaceholder.classList.remove('hidden');
    }
    
    openModal('mod-producto');
};

window.deleteProducto = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este producto?')) return;
    try {
        const p = productosGlobal.find(x => x.id === id);
        await db.collection("Productos").doc(id).delete();
        showToast("Producto eliminado", "success");
        if(p) logAuditChange('Inventario', 'Eliminar Producto', id, `Producto ${p.nombre} eliminado.`);
    } catch (error) {
        console.error(error);
        showToast("Error al eliminar", "error");
    }
};