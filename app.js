// ============================================================
//  DaldalaHub — Full JavaScript (SPA)
//  Language codes: en, am, om-ET
//  Database: Supabase (tables: dh_profiles, dh_products,
//            dh_orders, dh_order_items, dh_staff)
//  Storage: dh-product-images
//  Features: Image Upload + PDF Invoice + Chart.js + Notifications
//            + Multi-Staff + Payment (Chapa) + Dark Mode
// ============================================================

// ---------- 1. SUPABASE CONFIG ----------
// ⚠️ KAN JIJJIIRI: URL fi KEY kee galchi
const SUPABASE_URL = 'https://yjkgipivctdhezwvfwjx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlqa2dpcGl2Y3RkaGV6d3Zmd2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTYxODYsImV4cCI6MjEwMDk5MjE4Nn0.MaxngdvJ-SHrQ_qIok9_jU2-kxaVt_-OKOT03XKq_Kk';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- 2. STATE ----------
const state = {
  user: null,
  profile: null,
  products: [],
  orders: [],
  staff: [],
  editingProductId: null,
  currentLang: localStorage.getItem('lang') || 'en',
  translations: {},
  currentPage: 'login',
  pendingEmail: null,
  userRole: 'owner',
  pendingPaymentOrderId: null
};

const SUPPORTED_LANGS = ['en', 'am', 'om-ET'];

let salesChartInstance = null;
let statusChartInstance = null;
let realtimeChannel = null;

// ---------- 3. I18N ----------
async function loadTranslations(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) {
    lang = 'en';
  }

  try {
    const res = await fetch(`locales/${lang}.json`);
    if (!res.ok) throw new Error(`Failed to load ${lang}.json`);
    state.translations = await res.json();
    state.currentLang = lang;
    localStorage.setItem('lang', lang);
    applyTranslations();
    updateLangButtons();
    document.documentElement.lang = lang;
  } catch (err) {
    console.error('Translation load error:', err);
    if (lang !== 'en') {
      loadTranslations('en');
    }
  }
}

function t(key) {
  return state.translations[key] || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = value;
    } else {
      el.textContent = value;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

function updateLangButtons() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === state.currentLang);
  });
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => loadTranslations(btn.dataset.lang));
});

// ---------- 4. NAVIGATION (SPA) ----------
function showPage(page) {
  state.currentPage = page;

  document.getElementById('page-login').style.display = 'none';
  document.getElementById('page-register').style.display = 'none';
  document.getElementById('page-confirm').style.display = 'none';
  document.getElementById('page-app').style.display = 'none';

  if (page === 'login') {
    document.getElementById('page-login').style.display = 'flex';
  } else if (page === 'register') {
    document.getElementById('page-register').style.display = 'flex';
  } else if (page === 'confirm') {
    document.getElementById('page-confirm').style.display = 'flex';
  } else {
    document.getElementById('page-app').style.display = 'block';
    showView(page);
    updateNavLinks(page);
  }
}

function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  const target = document.getElementById('view-' + view);
  if (target) target.style.display = 'block';

  if (view === 'dashboard') loadDashboard();
  if (view === 'products') loadProducts();
  if (view === 'orders') loadOrders();
  if (view === 'staff') loadStaff();

  document.getElementById('sidebar')?.classList.remove('open');
}

function updateNavLinks(page) {
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.nav === page);
  });
}

document.querySelectorAll('[data-nav]').forEach(link => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    const target = link.dataset.nav;

    if (target === 'login' || target === 'register') {
      showPage(target);
    } else {
      const user = await db.auth.getUser();
      if (!user.data.user) {
        showPage('login');
        return;
      }
      showPage(target);
    }
  });
});

document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ---------- 5. AUTH ----------
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const alertBox = document.getElementById('loginAlert');

  try {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;

    alertBox.className = 'alert alert-success show';
    alertBox.textContent = t('login_success');
    setTimeout(() => initApp(), 700);
  } catch (err) {
    alertBox.className = 'alert alert-error show';
    alertBox.textContent = err.message;
  }
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const shop_name = document.getElementById('regShop').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const alertBox = document.getElementById('registerAlert');

  try {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { name, shop_name } }
    });
    if (error) throw error;

    if (data.user && !data.session) {
      state.pendingEmail = email;
      document.getElementById('confirmEmailAddress').textContent = email;
      showPage('confirm');
    } else {
      alertBox.className = 'alert alert-success show';
      alertBox.textContent = t('register_success');
      setTimeout(() => initApp(), 900);
    }
  } catch (err) {
    alertBox.className = 'alert alert-error show';
    alertBox.textContent = err.message;
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  if (realtimeChannel) {
    db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  await db.auth.signOut();
  state.user = null;
  state.profile = null;

  document.getElementById('loginAlert').className = 'alert';
  document.getElementById('registerAlert').className = 'alert';
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();

  showPage('login');
});

// ---------- 5.1 CONFIRM EMAIL PAGE ----------
document.getElementById('resendBtn')?.addEventListener('click', async () => {
  if (!state.pendingEmail) return;

  const btn = document.getElementById('resendBtn');
  btn.disabled = true;
  const originalText = btn.querySelector('span')?.textContent || 'Resend';
  btn.querySelector('span').textContent = t('sending');

  try {
    const { error } = await db.auth.resend({
      type: 'signup',
      email: state.pendingEmail
    });
    if (error) throw error;

    btn.querySelector('span').textContent = t('email_sent');
    setTimeout(() => {
      btn.disabled = false;
      btn.querySelector('span').textContent = originalText;
    }, 3000);
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
    btn.querySelector('span').textContent = originalText;
  }
});

document.getElementById('backToLoginBtn')?.addEventListener('click', () => {
  showPage('login');
});

// ---------- 6. APP INIT ----------
async function initApp() {
  const { data: { user } } = await db.auth.getUser();

  if (!user) {
    showPage('login');
    return;
  }

  state.user = user;

  let { data: profile } = await db
    .from('dh_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const { data: newProfile } = await db
      .from('dh_profiles')
      .insert({
        id: user.id,
        name: user.user_metadata?.name || user.email.split('@')[0],
        shop_name: user.user_metadata?.shop_name || 'My Shop'
      })
      .select()
      .single();
    profile = newProfile;
  }

  state.profile = profile;

  // User role mirkaneessi (Feature 5)
  const { data: staffRecord } = await db
    .from('dh_staff')
    .select('role, status')
    .eq('staff_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (staffRecord) {
    state.userRole = staffRecord.role;
  } else {
    state.userRole = 'owner';
  }

  const staffNavLink = document.getElementById('staffNavLink');
  if (staffNavLink) {
    if (state.userRole === 'owner' || state.userRole === 'manager') {
      staffNavLink.style.display = 'flex';
    } else {
      staffNavLink.style.display = 'none';
    }
  }

  const nameEl = document.getElementById('userName');
  const emailEl = document.getElementById('userEmail');
  const shopEl = document.getElementById('shopName');
  const avatarEl = document.getElementById('userAvatar');

  if (nameEl) nameEl.textContent = profile?.name || user.email;
  if (emailEl) emailEl.textContent = user.email;
  if (shopEl) shopEl.textContent = profile?.shop_name || '';
  if (avatarEl) avatarEl.textContent = (profile?.name || user.email).charAt(0).toUpperCase();

  // Realtime subscription
  setupRealtimeSubscription(user.id);

  showPage('dashboard');

  // Payment callback yeroo Chapa irraa deebi'u
  setTimeout(() => handlePaymentCallback(), 500);
}

// ---------- 6.1 REALTIME SUBSCRIPTION (FEATURE 4) ----------
function setupRealtimeSubscription(userId) {
  if (realtimeChannel) {
    db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = db
    .channel('dh_orders_realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'dh_orders',
        filter: `owner_id=eq.${userId}`
      },
      async (payload) => {
        const order = payload.new;

        showToast(
          '🛒 ' + t('add_order'),
          `${order.customer_name} — ETB ${Number(order.total).toLocaleString()}`,
          'success',
          5000
        );

        if (state.currentPage === 'dashboard') {
          await loadDashboard();
        } else if (state.currentPage === 'orders') {
          await loadOrders();
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'dh_orders',
        filter: `owner_id=eq.${userId}`
      },
      async (payload) => {
        const order = payload.new;

        if (payload.old && payload.old.status !== order.status) {
          showToast(
            t('status'),
            `${order.customer_name}: ${t(order.status)}`,
            'info',
            4000
          );
        }

        if (state.currentPage === 'dashboard') {
          await loadDashboard();
        } else if (state.currentPage === 'orders') {
          await loadOrders();
        }
      }
    )
    .subscribe((status) => {
      console.log('Realtime subscription status:', status);
    });
}

// ---------- 7. DASHBOARD ----------
async function loadDashboard() {
  if (!state.user) return;

  const [ordersRes, productsRes] = await Promise.all([
    db.from('dh_orders').select('*').eq('owner_id', state.user.id),
    db.from('dh_products').select('*').eq('owner_id', state.user.id)
  ]);

  const orders = ordersRes.data || [];
  const products = productsRes.data || [];

  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total), 0);

  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const lowStock = products.filter(p => p.stock < 5).length;

  document.getElementById('totalRevenue').textContent = `ETB ${totalRevenue.toLocaleString()}`;
  document.getElementById('totalOrders').textContent = orders.length;
  document.getElementById('totalProducts').textContent = products.length;
  document.getElementById('pendingOrders').textContent = pendingOrders;

  const warn = document.getElementById('lowStockWarning');
  if (lowStock > 0) {
    warn.style.display = 'block';
    warn.textContent = `⚠️ ${lowStock} ${t('low_stock_warning')}`;
  } else {
    warn.style.display = 'none';
  }

  renderSalesChart(orders);
  renderStatusChart(orders);
  renderRecentOrders(orders.slice(0, 5));
}

// ============ CHART.JS: SALES (BAR) ============
function renderSalesChart(orders) {
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const salesByMonth = {};
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    salesByMonth[monthNames[d.getMonth()]] = 0;
  }

  orders.forEach(o => {
    const d = new Date(o.created_at);
    const key = monthNames[d.getMonth()];
    if (key in salesByMonth) salesByMonth[key] += Number(o.total);
  });

  if (salesChartInstance) {
    salesChartInstance.destroy();
    salesChartInstance = null;
  }

  const canvas = document.getElementById('salesChartJs');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  // Theme colors
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const tickColor = isDark ? '#94a3b8' : '#64748b';

  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.9)');
  gradient.addColorStop(1, 'rgba(129, 140, 248, 0.4)');

  salesChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(salesByMonth),
      datasets: [{
        label: 'Sales (ETB)',
        data: Object.values(salesByMonth),
        backgroundColor: gradient,
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return `ETB ${Number(context.raw).toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: gridColor, drawBorder: false },
          ticks: {
            color: tickColor,
            font: { size: 11, weight: '600' },
            callback: (value) => {
              if (value >= 1000) return `ETB ${(value / 1000).toFixed(0)}k`;
              return `ETB ${value}`;
            }
          }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: tickColor,
            font: { size: 12, weight: '600' }
          }
        }
      }
    }
  });
}

// ============ CHART.JS: STATUS (DOUGHNUT) ============
function renderStatusChart(orders) {
  const statusCount = {
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0
  };

  orders.forEach(o => {
    if (statusCount[o.status] !== undefined) {
      statusCount[o.status]++;
    }
  });

  if (statusChartInstance) {
    statusChartInstance.destroy();
    statusChartInstance = null;
  }

  const canvas = document.getElementById('statusChartJs');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const borderColor = isDark ? '#1e293b' : '#fff';

  statusChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCount).map(s => t(s)),
      datasets: [{
        data: Object.values(statusCount),
        backgroundColor: [
          '#f59e0b',
          '#3b82f6',
          '#8b5cf6',
          '#10b981',
          '#ef4444'
        ],
        borderWidth: 3,
        borderColor: borderColor,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            font: { size: 13, weight: '600' },
            color: textColor,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const value = context.raw;
              const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return ` ${context.label}: ${value} (${percent}%)`;
            }
          }
        }
      }
    }
  });
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentOrdersBody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-light)">${t('no_orders')}</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong>${escapeHtml(o.customer_name)}</strong></td>
      <td>ETB ${Number(o.total).toLocaleString()}</td>
      <td><span class="badge badge-${getStatusClass(o.status)}">${t(o.status)}</span></td>
      <td>${new Date(o.created_at).toLocaleDateString()}</td>
    </tr>
  `).join('');
}

// ---------- 8. PRODUCTS ----------
async function loadProducts() {
  if (!state.user) return;

  const { data, error } = await db
    .from('dh_products')
    .select('*')
    .eq('owner_id', state.user.id)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  state.products = data || [];
  renderProducts();
}

// ---------- 8.1 IMAGE UPLOAD (FEATURE 1) ----------
async function uploadProductImage(file) {
  if (!file) return null;

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image too large (max 5MB)');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `${state.user.id}/${Date.now()}.${ext}`;

  const { data, error } = await db.storage
    .from('dh-product-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  const { data: urlData } = db.storage
    .from('dh-product-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');

  if (state.products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <p>${t('no_products')}</p>
      </div>`;
    return;
  }

  grid.innerHTML = state.products.map(p => {
    const stockClass = p.stock < 5 ? 'danger' : p.stock < 20 ? 'warning' : 'success';

    const imageHtml = p.image_url
      ? `<img src="${p.image_url}" alt="${escapeHtml(p.name)}" 
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
         <div class="product-image-placeholder" style="display: none">📦</div>`
      : `<div class="product-image-placeholder">📦</div>`;

    return `
      <div class="product-card">
        ${imageHtml}
        <div class="product-header">
          <h3 class="product-name">${escapeHtml(p.name)}</h3>
          <span class="badge badge-${stockClass}">${t('stock')}: ${p.stock}</span>
        </div>
        <p class="product-category">${escapeHtml(p.category || '—')}</p>
        <p class="product-price">ETB ${Number(p.price).toLocaleString()}</p>
        <div class="product-actions">
          <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">✏️ ${t('edit')}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">🗑️ ${t('delete')}</button>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('addProductBtn')?.addEventListener('click', () => {
  state.editingProductId = null;
  document.getElementById('productForm').reset();
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('productModalTitle').textContent = t('add_product');
  document.getElementById('productModal').classList.add('active');
});

document.getElementById('cancelProductBtn')?.addEventListener('click', () => {
  document.getElementById('productModal').classList.remove('active');
});

document.getElementById('productModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'productModal') e.target.classList.remove('active');
});

document.getElementById('pImage')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('imagePreviewImg');

  if (!file) {
    preview.style.display = 'none';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Image too large (max 5MB)');
    e.target.value = '';
    preview.style.display = 'none';
    return;
  }

  if (!file.type.startsWith('image/')) {
    alert('File must be an image');
    e.target.value = '';
    preview.style.display = 'none';
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    previewImg.src = ev.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

document.getElementById('productForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const imageFile = document.getElementById('pImage').files[0];

    const payload = {
      name: document.getElementById('pName').value.trim(),
      category: document.getElementById('pCategory').value.trim(),
      price: parseFloat(document.getElementById('pPrice').value) || 0,
      cost: parseFloat(document.getElementById('pCost').value) || 0,
      stock: parseInt(document.getElementById('pStock').value) || 0,
      description: document.getElementById('pDescription').value.trim(),
      owner_id: state.user.id
    };

    if (imageFile) {
      payload.image_url = await uploadProductImage(imageFile);
    }

    if (state.editingProductId) {
      await db.from('dh_products').update(payload).eq('id', state.editingProductId);
    } else {
      await db.from('dh_products').insert(payload);
    }

    document.getElementById('productModal').classList.remove('active');
    document.getElementById('productForm').reset();
    document.getElementById('imagePreview').style.display = 'none';
    state.editingProductId = null;
    await loadProducts();
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

function editProduct(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;

  state.editingProductId = id;
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pPrice').value = p.price || '';
  document.getElementById('pCost').value = p.cost || '';
  document.getElementById('pStock').value = p.stock || '';
  document.getElementById('pDescription').value = p.description || '';

  const preview = document.getElementById('imagePreview');
  const previewImg = document.getElementById('imagePreviewImg');
  const imageInput = document.getElementById('pImage');

  imageInput.value = '';

  if (p.image_url) {
    previewImg.src = p.image_url;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  document.getElementById('productModalTitle').textContent = t('edit');
  document.getElementById('productModal').classList.add('active');
}

async function deleteProduct(id) {
  if (!confirm(t('confirm_delete'))) return;
  await db.from('dh_products').delete().eq('id', id);
  await loadProducts();
}

// ---------- 9. ORDERS ----------
async function loadOrders() {
  if (!state.user) return;

  const { data, error } = await db
    .from('dh_orders')
    .select('*, dh_order_items(*)')
    .eq('owner_id', state.user.id)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  state.orders = data || [];
  renderOrders();
}

function renderOrders() {
  const tbody = document.getElementById('ordersBody');
  if (!tbody) return;

  if (state.orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-light)">${t('no_orders')}</td></tr>`;
    return;
  }

  tbody.innerHTML = state.orders.map(o => {
    const items = (o.dh_order_items || [])
      .map(i => `${escapeHtml(i.product_name)} ×${i.quantity}`)
      .join(', ') || '—';

    const isPaid = o.payment_status === 'paid';

    return `
      <tr>
        <td>
          <strong>${escapeHtml(o.customer_name)}</strong><br>
          <small style="color:var(--text-light)">${escapeHtml(o.customer_phone || '')}</small>
        </td>
        <td><small>${items}</small></td>
        <td><strong>ETB ${Number(o.total).toLocaleString()}</strong></td>
        <td><span class="badge badge-${getStatusClass(o.status)}">${t(o.status)}</span></td>
        <td><small>${new Date(o.created_at).toLocaleDateString()}</small></td>
        <td>
          <select class="form-control" style="padding:6px 10px;font-size:13px" onchange="updateOrderStatus('${o.id}', this.value)">
            ${['pending','processing','shipped','delivered','cancelled'].map(s =>
              `<option value="${s}" ${s === o.status ? 'selected' : ''}>${t(s)}</option>`
            ).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" style="margin-top:6px;width:100%" onclick="downloadInvoice('${o.id}')">
            📄 ${t('pdf')}
          </button>
          ${isPaid
            ? `<span class="badge badge-success" style="margin-top:6px;width:100%;display:inline-block;text-align:center;padding:8px 10px">
                ✅ ${t('paid')}
              </span>`
            : `<button class="btn btn-primary btn-sm" style="margin-top:6px;width:100%" onclick="openPaymentModal('${o.id}')">
                💳 ${t('pay_now')}
              </button>`
          }
        </td>
      </tr>`;
  }).join('');
}

async function updateOrderStatus(id, status) {
  await db.from('dh_orders').update({ status }).eq('id', id);
  await loadOrders();
}

document.getElementById('addOrderBtn')?.addEventListener('click', () => {
  document.getElementById('orderForm').reset();
  document.getElementById('orderItems').innerHTML = '';
  addOrderItemRow();
  document.getElementById('orderModal').classList.add('active');
});

document.getElementById('cancelOrderBtn')?.addEventListener('click', () => {
  document.getElementById('orderModal').classList.remove('active');
});

document.getElementById('orderModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'orderModal') e.target.classList.remove('active');
});

document.getElementById('addItemRowBtn')?.addEventListener('click', addOrderItemRow);

document.getElementById('orderForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const customerName = document.getElementById('oCustomerName').value.trim();
  const customerPhone = document.getElementById('oCustomerPhone').value.trim();

  const rows = document.querySelectorAll('.order-item-row');
  const items = [];
  let total = 0;

  rows.forEach(row => {
    const name = row.querySelector('.item-name').value.trim();
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    const qty = parseInt(row.querySelector('.item-qty').value) || 1;

    if (name && price > 0) {
      items.push({ product_name: name, price, quantity: qty });
      total += price * qty;
    }
  });

  if (items.length === 0) {
    alert('Add at least one item');
    return;
  }

  const { data: orderData, error: orderErr } = await db
    .from('dh_orders')
    .insert({
      owner_id: state.user.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      total,
      status: 'pending',
      payment_status: 'unpaid'
    })
    .select()
    .single();

  if (orderErr) { alert(orderErr.message); return; }

  await db.from('dh_order_items').insert(
    items.map(i => ({ ...i, order_id: orderData.id }))
  );

  document.getElementById('orderModal').classList.remove('active');
  await loadOrders();
});

function addOrderItemRow() {
  const container = document.getElementById('orderItems');
  const row = document.createElement('div');
  row.className = 'order-item-row';
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center';
  row.innerHTML = `
    <input type="text" class="form-control item-name" placeholder="${t('products')}" required>
    <input type="number" class="form-control item-price" placeholder="${t('price')}" required min="0" step="0.01">
    <input type="number" class="form-control item-qty" placeholder="Qty" value="1" required min="1">
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(row);
}

// ---------- 9.1 PDF INVOICE (FEATURE 2) ----------
function generateInvoice(order) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const profile = state.profile;
  const shopName = profile?.shop_name || 'My Shop';
  const shopPhone = profile?.phone || '';

  doc.setFontSize(24);
  doc.setTextColor(99, 102, 241);
  doc.setFont(undefined, 'bold');
  doc.text('DaldalaHub', 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.setFont(undefined, 'normal');
  doc.text(shopName, 14, 30);
  if (shopPhone) {
    doc.text(`Phone: ${shopPhone}`, 14, 36);
  }

  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59);
  doc.setFont(undefined, 'bold');
  doc.text('INVOICE', 196, 22, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont(undefined, 'normal');
  doc.text(`#${order.id.slice(0, 8).toUpperCase()}`, 196, 30, { align: 'right' });
  doc.text(new Date(order.created_at).toLocaleDateString(), 196, 36, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 44, 196, 44);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont(undefined, 'bold');
  doc.text('BILL TO:', 14, 54);

  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(order.customer_name || 'Customer', 14, 61);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont(undefined, 'normal');
  if (order.customer_phone) {
    doc.text(order.customer_phone, 14, 67);
  }

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont(undefined, 'bold');
  doc.text('STATUS:', 120, 54);
  doc.setFont(undefined, 'normal');
  doc.text((order.status || 'pending').toUpperCase(), 120, 61);

  const items = (order.dh_order_items || []).map(i => [
    i.product_name || 'Item',
    i.quantity.toString(),
    `ETB ${Number(i.price).toLocaleString()}`,
    `ETB ${(Number(i.price) * i.quantity).toLocaleString()}`
  ]);

  doc.autoTable({
    startY: 78,
    head: [['Item', 'Qty', 'Price', 'Total']],
    body: items,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 11
    },
    bodyStyles: {
      fontSize: 10,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  doc.setFillColor(248, 250, 252);
  doc.rect(120, finalY - 2, 76, 14, 'F');

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.setFont(undefined, 'normal');
  doc.text('Total:', 125, finalY + 6);

  doc.setFontSize(13);
  doc.setTextColor(99, 102, 241);
  doc.setFont(undefined, 'bold');
  doc.text(`ETB ${Number(order.total).toLocaleString()}`, 191, finalY + 6, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.setFont(undefined, 'italic');
  doc.text('Thank you for your business!', 14, 285);

  doc.setFont(undefined, 'normal');
  doc.text('Generated by DaldalaHub', 14, 290);
  doc.text(new Date().toLocaleString(), 196, 290, { align: 'right' });

  doc.save(`invoice-${order.id.slice(0, 8)}.pdf`);
}

function downloadInvoice(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) {
    alert('Order not found');
    return;
  }
  generateInvoice(order);
}

// ---------- 9.2 NOTIFICATIONS (FEATURE 4) ----------
function showToast(title, message, type = 'info', duration = 5000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️',
    error: '❌'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || '🔔'}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Close">✕</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  container.appendChild(toast);

  setTimeout(() => removeToast(toast), duration);

  playBeep();
}

function removeToast(toast) {
  if (!toast.parentElement) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}

function playBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 800;
    osc.type = 'sine';

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (err) {
    // Audio error — silent fail
  }
}

// ---------- 9.3 STAFF MANAGEMENT (FEATURE 5) ----------
async function loadStaff() {
  if (!state.user) return;

  if (state.userRole !== 'owner' && state.userRole !== 'manager') {
    showToast('Permission Denied', 'Staff page ilaaluuf hayyama hin qabdu', 'error');
    showView('dashboard');
    return;
  }

  const { data, error } = await db
    .from('dh_staff')
    .select('*')
    .eq('owner_id', state.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  state.staff = data || [];
  renderStaff();
}

function renderStaff() {
  const tbody = document.getElementById('staffBody');
  if (!tbody) return;

  if (state.staff.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:40px;color:var(--text-light)">
          ${t('no_staff')}
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = state.staff.map(s => {
    const roleClass = `role-${s.role}`;
    const statusClass = `status-${s.status || 'active'}`;

    return `
      <tr>
        <td><strong>${escapeHtml(s.staff_email)}</strong></td>
        <td>
          <span class="role-badge ${roleClass}">${t('role_' + s.role)}</span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${s.status || 'active'}</span>
        </td>
        <td><small>${new Date(s.created_at).toLocaleDateString()}</small></td>
        <td>
          <div class="staff-actions">
            <select class="form-control" style="padding:6px 8px;font-size:12px;width:auto"
              onchange="updateStaffRole('${s.id}', this.value)">
              <option value="viewer" ${s.role === 'viewer' ? 'selected' : ''}>${t('role_viewer')}</option>
              <option value="cashier" ${s.role === 'cashier' ? 'selected' : ''}>${t('role_cashier')}</option>
              <option value="manager" ${s.role === 'manager' ? 'selected' : ''}>${t('role_manager')}</option>
            </select>
            <button class="btn btn-danger btn-sm" onclick="deleteStaff('${s.id}')">
              🗑️ ${t('delete_staff')}
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

document.getElementById('addStaffBtn')?.addEventListener('click', () => {
  if (state.userRole !== 'owner') {
    showToast('Permission Denied', 'Staff dabaluuf owner qofa hayyama qaba', 'error');
    return;
  }

  document.getElementById('staffForm').reset();
  document.getElementById('staffModalTitle').textContent = t('add_staff');
  document.getElementById('staffModal').classList.add('active');
});

document.getElementById('cancelStaffBtn')?.addEventListener('click', () => {
  document.getElementById('staffModal').classList.remove('active');
});

document.getElementById('staffModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'staffModal') e.target.classList.remove('active');
});

document.getElementById('staffForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (state.userRole !== 'owner') {
    showToast('Permission Denied', 'Staff dabaluuf owner qofa hayyama qaba', 'error');
    return;
  }

  const email = document.getElementById('staffEmail').value.trim().toLowerCase();
  const role = document.getElementById('staffRole').value;

  if (!email) {
    showToast('Error', 'Email barbaachisa', 'error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = t('sending');

  try {
    const { error: insertErr } = await db
      .from('dh_staff')
      .insert({
        owner_id: state.user.id,
        staff_id: state.user.id,
        staff_email: email,
        role: role,
        status: 'active'
      });

    if (insertErr) throw insertErr;

    showToast(
      '✅ ' + t('add_staff'),
      `${email} — ${t('role_' + role)}`,
      'success',
      4000
    );

    document.getElementById('staffModal').classList.remove('active');
    document.getElementById('staffForm').reset();
    await loadStaff();

  } catch (err) {
    console.error(err);
    showToast('Error', err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});

async function updateStaffRole(staffId, newRole) {
  if (state.userRole !== 'owner') {
    showToast('Permission Denied', 'Role jijjiiruuf owner qofa hayyama qaba', 'error');
    await loadStaff();
    return;
  }

  try {
    const { error } = await db
      .from('dh_staff')
      .update({ role: newRole })
      .eq('id', staffId)
      .eq('owner_id', state.user.id);

    if (error) throw error;

    showToast(
      '✅ ' + t('edit_staff'),
      `${t('role')}: ${t('role_' + newRole)}`,
      'success',
      3000
    );

    await loadStaff();
  } catch (err) {
    console.error(err);
    showToast('Error', err.message, 'error');
    await loadStaff();
  }
}

async function deleteStaff(staffId) {
  if (state.userRole !== 'owner') {
    showToast('Permission Denied', 'Staff haquuf owner qofa hayyama qaba', 'error');
    return;
  }

  if (!confirm(t('confirm_delete_staff'))) return;

  try {
    const { error } = await db
      .from('dh_staff')
      .delete()
      .eq('id', staffId)
      .eq('owner_id', state.user.id);

    if (error) throw error;

    showToast('✅ ' + t('delete_staff'), '', 'success', 3000);
    await loadStaff();
  } catch (err) {
    console.error(err);
    showToast('Error', err.message, 'error');
  }
}

// ---------- 9.4 PAYMENT (FEATURE 6 — CHAPA) ----------
function openPaymentModal(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) {
    showToast('Error', 'Order not found', 'error');
    return;
  }

  if (order.payment_status === 'paid') {
    showToast('Info', 'Order already paid', 'info');
    return;
  }

  state.pendingPaymentOrderId = orderId;
  document.getElementById('paymentModal').classList.add('active');
}

document.getElementById('cancelPaymentBtn')?.addEventListener('click', () => {
  state.pendingPaymentOrderId = null;
  document.getElementById('paymentModal').classList.remove('active');
});

document.getElementById('paymentModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'paymentModal') {
    state.pendingPaymentOrderId = null;
    e.target.classList.remove('active');
  }
});

document.getElementById('confirmPaymentBtn')?.addEventListener('click', async () => {
  const orderId = state.pendingPaymentOrderId;
  if (!orderId) return;

  document.getElementById('paymentModal').classList.remove('active');

  await payOrder(orderId);
});

async function payOrder(orderId) {
  if (!state.user) return;

  const order = state.orders.find(o => o.id === orderId);
  if (!order) {
    showToast('Error', 'Order not found', 'error');
    return;
  }

  if (order.payment_status === 'paid') {
    showToast('Info', 'Order already paid', 'info');
    return;
  }

  try {
    showToast('💳 ' + t('payment_processing'), t('payment_processing'), 'info', 3000);

    // Edge Function call — chapa-init
    const { data, error } = await db.functions.invoke('chapa-init', {
      body: {
        amount: Number(order.total),
        email: state.user.email,
        firstName: (state.profile?.name || 'Customer').split(' ')[0],
        lastName: (state.profile?.name || 'User').split(' ').slice(1).join(' ') || 'User',
        phone: order.customer_phone || '',
        orderId: order.id
      }
    });

    if (error) throw error;
    if (!data || !data.checkout_url) throw new Error('Invalid response from payment server');

    localStorage.setItem('chapa_tx_ref', data.tx_ref);
    localStorage.setItem('chapa_order_id', order.id);

    window.location.href = data.checkout_url;

  } catch (err) {
    console.error('Payment error:', err);
    showToast('Payment Error', err.message || 'Failed to initialize payment', 'error', 5000);
  }
}

// ---------- 9.5 PAYMENT CALLBACK ----------
async function handlePaymentCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const payment = urlParams.get('payment');
  const orderId = urlParams.get('order');

  if (payment === 'success' && orderId) {
    const txRef = localStorage.getItem('chapa_tx_ref');

    if (txRef) {
      try {
        showToast('✅ ' + t('verifying'), t('verifying'), 'info', 3000);

        const { data, error } = await db.functions.invoke('chapa-verify', {
          body: { tx_ref: txRef, orderId: orderId }
        });

        if (error) throw error;

        if (data && data.paid) {
          showToast('✅ ' + t('payment_success'), 'Order paid successfully!', 'success', 5000);
        } else {
          showToast('⚠️ ' + t('payment_failed'), 'Payment not confirmed', 'warning', 5000);
        }

        localStorage.removeItem('chapa_tx_ref');
        localStorage.removeItem('chapa_order_id');

        if (state.currentPage === 'orders') {
          await loadOrders();
        } else if (state.currentPage === 'dashboard') {
          await loadDashboard();
        }
      } catch (err) {
        console.error('Verify error:', err);
        showToast('Verify Error', err.message, 'error', 5000);
      }
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// ---------- 9.6 THEME TOGGLE (DARK MODE) ----------
function initTheme() {
  // Check localStorage
  const savedTheme = localStorage.getItem('theme');

  // Yoo saved theme jiraate → fayyadami
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  } else {
    // Ykn — system preference check
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = prefersDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);

  // Charts re-render — theme colors jijjiiruuf
  if (state.user) {
    if (state.currentPage === 'dashboard') {
      loadDashboard();
    }
  }
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  if (theme === 'dark') {
    btn.textContent = '☀️'; // Sun — light mode'f
    btn.title = 'Switch to light mode';
  } else {
    btn.textContent = '🌙'; // Moon — dark mode'f
    btn.title = 'Switch to dark mode';
  }
}

// Theme toggle listener
document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

// ---------- 10. HELPERS ----------
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function getStatusClass(status) {
  return {
    pending: 'warning',
    processing: 'info',
    shipped: 'purple',
    delivered: 'success',
    cancelled: 'danger'
  }[status] || 'info';
}

// ---------- 11. BOOT ----------
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadTranslations(state.currentLang);

  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      state.user = session.user;
      initApp();
    }
  });

  const { data: { user } } = await db.auth.getUser();
  if (user) {
    initApp();
  } else {
    showPage('login');
  }
});