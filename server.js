const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_PATH = path.join(__dirname, 'db.json');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ panels: {} }));

const getDB = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const saveDB = (db) => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

app.use(session({
  secret: process.env.SESSION_SECRET || 'nebula-ultra-secret',
  resave: false, saveUninitialized: false,
  cookie: { secure: 'auto', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, req.customFilename) // Fixed Slug Bug
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const requireAuth = (req, res, next) => req.session.auth ? next() : res.redirect('/login');
const formatDate = (iso) => new Date(iso).toLocaleDateString('fa-IR');

function getTimeRemaining(iso) {
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return { text: 'پایان زمان', color: '#ef4444' };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  let color = '#10b981';
  if (days < 3) color = '#f59e0b';
  if (days < 1) color = '#ef4444';
  return { text: `${days} روز و ${hours} ساعت`, color };
}

function escapeHTML(str) { return str ? str.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }

// --- AUTH ---
app.get('/login', (req, res) => {
  if (req.session.auth) return res.redirect('/');
  res.send(renderLayout('ورود', `
    <div class="login-wrap">
      <div class="glass-strong login-card fade-in-up">
        <div class="logo-wrap pulse-glow"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
        <h2 class="text-gradient" style="font-size:28px; font-weight:900; margin-bottom:8px;">Nebula Panels</h2>
        <p style="opacity:.5; margin-bottom:24px; font-size:14px;">برای ورود به داشبورد رمز عبور را وارد کنید</p>
        ${req.query.err ? '<div class="error-box">رمز عبور اشتباه است</div>' : ''}
        <form method="POST" action="/login" class="stack">
          <div style="position:relative;">
            <input type="password" id="mainPass" name="password" placeholder="رمز عبور" required class="input" style="padding-left:45px;">
            <button type="button" onclick="toggleMainPass()" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:inherit; cursor:pointer; font-size:18px; opacity:0.6;">👁️</button>
          </div>
          <button class="btn-neon" type="submit">ورود به پنل ✨</button>
        </form>
      </div>
    </div>
  `, `
    function toggleMainPass() {
      const p = document.getElementById('mainPass');
      p.type = p.type === 'password' ? 'text' : 'password';
    }
  `));
});

app.post('/login', (req, res) => {
  const pass = (req.body.password || '').trim();
  const realPass = (process.env.APP_PASSWORD || 'arian@11USER').trim();
  if (pass === realPass) { req.session.auth = true; return res.redirect('/'); }
  res.redirect('/login?err=1');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// --- DASHBOARD ---
app.get('/', requireAuth, (req, res) => {
  const db = getDB();
  const panels = Object.values(db.panels).sort((a, b) => new Date(b.created) - new Date(a.created));
  const activeCount = panels.filter(p => p.status === 'active' && new Date(p.expires) > new Date()).length;
  const expiredCount = panels.filter(p => new Date(p.expires) <= new Date()).length;
  const pausedCount = panels.filter(p => p.status === 'paused').length;

  const panelsHTML = panels.length === 0 
    ? `<div class="glass empty-state fade-in-up"><div style="font-size:60px; margin-bottom:16px;">🌌</div><h3>هنوز پنلی نساخته‌اید</h3><button class="btn-neon" onclick="openModal()" style="margin-top:16px;">ساخت اولین پنل ✨</button></div>`
    : panels.map(p => {
        const isExpired = new Date(p.expires) <= new Date();
        const isPaused = p.status === 'paused';
        const time = getTimeRemaining(p.expires);
        const url = `${req.protocol}://${req.get('host')}/view/${p.id}`;
        const tagsHTML = (p.tags || []).map(t => `<span class="tag-badge">${escapeHTML(t)}</span>`).join('');
        
        let statusBadge = isExpired ? `<span class="badge badge-danger">⏰ منقضی</span>` : 
                          isPaused ? `<span class="badge badge-warn">⏸ متوقف</span>` : 
                          `<span class="badge badge-success"><span class="dot"></span> فعال</span>`;

        return `
        <div class="glass card shine fade-in-up" data-name="${escapeHTML(p.name)}" data-tags="${escapeHTML((p.tags||[]).join(' '))}">
          <div class="card-header">
            <div class="card-icon">＜＞</div>
            <div class="card-info">
              <div class="card-title-row">
                <span class="card-title">${escapeHTML(p.name)}</span>
                <span class="badge badge-html">HTML</span>
                ${p.password ? '<span class="badge badge-warn">🔒 رمزدار</span>' : ''}
                ${statusBadge}
              </div>
              <div class="card-meta">ساخت: ${formatDate(p.created)} • بازدید: ${p.views || 0}</div>
              <div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">${tagsHTML}</div>
            </div>
          </div>
          
          <div class="card-stats">
             <div class="stat-box">
                <span class="stat-label">${isExpired ? 'وضعیت' : 'زمان باقی‌مانده'}</span>
                <span class="stat-value" style="color:${isExpired ? '#ef4444' : time.color}">${isExpired ? 'پایان زمان' : time.text}</span>
             </div>
             <div class="card-actions">
                <button class="action-btn" onclick="navigator.clipboard.writeText('${url}'); this.innerHTML='✅'; setTimeout(()=>this.innerHTML='📋', 1500);" title="کپی">📋</button>
                <button class="action-btn" onclick="showQR('${url}')" title="QR Code">📱</button>
                <a href="${url}" target="_blank" class="action-btn" title="باز کردن">↗</a>
                <a href="/edit/${p.id}" class="action-btn" title="ویرایش">✏️</a>
                <button class="action-btn delete-btn" onclick="deletePanel('${p.id}')" title="حذف">🗑️</button>
                <div class="toggle ${isExpired || isPaused ? '' : 'active'}" onclick="togglePanel('${p.id}')"><div class="toggle-thumb"></div></div>
             </div>
          </div>
          <div class="card-url"><span>🔗</span><span class="url-text" dir="ltr">${url}</span></div>
          <button class="btn-ghost" onclick="extendPanel('${p.id}')">تمدید زمان ⏳</button>
        </div>`;
    }).join('');

  res.send(renderLayout('داشبورد', `
    <header class="glass header">
      <div class="header-inner">
        <div class="brand">
          <div class="logo-sm pulse-glow"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
          <div><div class="text-gradient" style="font-weight:900; font-size:18px;">Nebula Panels</div><div style="font-size:11px;opacity:.4">پنل‌ساز ابری</div></div>
        </div>
        <div class="header-actions">
          <button class="btn-ghost" onclick="toggleTheme()" title="تغییر تم">🌓</button>
          <button class="btn-neon" onclick="openModal()">✨ ساخت پنل جدید</button>
          <a href="/logout" class="btn-ghost">خروج</a>
        </div>
      </div>
    </header>

    <main>
      <section class="hero-section fade-in-up">
        <h1 class="page-title">خوش آمدی به <span class="text-gradient">داشبورد</span> ✨</h1>
        <p class="page-subtitle">مدیریت، آپلود و اشتراک‌گذاری فایل‌های HTML.</p>
      </section>

      <section class="stats fade-in-up">
        <div class="glass stat shine"><div class="stat-icon" style="background:linear-gradient(135deg,#8b5cf6,#ec4899)">📊</div><div class="stat-num">${panels.length}</div><div class="stat-label">کل پنل‌ها</div></div>
        <div class="glass stat shine"><div class="stat-icon" style="background:linear-gradient(135deg,#10b981,#06b6d4)">✅</div><div class="stat-num">${activeCount}</div><div class="stat-label">فعال</div></div>
        <div class="glass stat shine"><div class="stat-icon" style="background:linear-gradient(135deg,#fb923c,#ec4899)">⏰</div><div class="stat-num">${expiredCount}</div><div class="stat-label">منقضی</div></div>
        <div class="glass stat shine"><div class="stat-icon" style="background:linear-gradient(135deg,#f87171,#ef4444)">⛔</div><div class="stat-num">${pausedCount}</div><div class="stat-label">متوقف</div></div>
      </section>

      <section class="fade-in-up">
        <div class="section-header">
           <h3 class="section-title"><span class="text-gradient">پنل‌های من</span> <span class="badge badge-ghost">${panels.length} پنل</span></h3>
           <input type="text" id="searchInput" placeholder="جستجو در نام و تگ‌ها..." class="input" style="max-width:250px; padding:10px 14px; font-size:13px;">
        </div>
        <div class="panels-grid" id="panelsGrid">${panelsHTML}</div>
      </section>
    </main>

    <!-- MODAL -->
    <div id="modal" class="modal-overlay" onclick="if(event.target===this) closeModal()">
      <div class="modal-content glass-strong fade-in-up">
        <div class="modal-header"><h3 style="font-size:22px; font-weight:900;">ساخت پنل جدید ✨</h3><button class="action-btn" onclick="closeModal()">✕</button></div>
        <form id="uploadForm" enctype="multipart/form-data" class="stack">
          <div class="dropzone" id="dropzone">
            <div class="drop-ico float-y">☁️</div>
            <div class="drop-title">فایل HTML را انتخاب کنید</div>
            <div class="file-name" id="fileName"></div>
            <input type="file" id="fileInput" name="htmlFile" accept=".html" required hidden>
          </div>
          <input type="text" name="name" placeholder="نام پنل (مثلا: سایت من)" required class="input">
          <input type="text" name="tags" placeholder="تگ‌ها (با کاما جدا کنید: پروژه, شخصی)" class="input">
          <input type="password" name="panelPass" placeholder="رمز عبور برای این لینک (اختیاری)" class="input">
          
          <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:14px; padding: 0 16px;">
             <span style="opacity:.5; font-size:13px; white-space:nowrap; font-family:monospace;" dir="ltr">/view/</span>
             <input type="text" name="customSlug" placeholder="لینک دلخواه (اختیاری)" class="input" style="border:none; background:transparent; padding:14px 0; flex:1; box-shadow:none;">
          </div>
          <div style="font-size:11px; opacity:.4; margin-top:-8px;">فقط حروف انگلیسی، اعداد و خط تیره. خالی = لینک رندوم</div>
          
          <select name="expiry" id="expirySelect" required class="input">
            <option value="1">1 روز</option><option value="7">7 روز</option><option value="30" selected>1 ماه</option><option value="365">1 سال</option><option value="custom">⚙️ زمان دلخواه...</option>
          </select>
          <div id="customWrap" style="display:none;"><input type="number" name="customDays" id="customDays" placeholder="تعداد روز" min="1" class="input"></div>
          <button class="btn-neon" type="submit" id="submitBtn">آپلود و ساخت لینک 🚀</button>
          <div id="result" style="text-align:center; font-weight:700; font-size:14px;"></div>
        </form>
      </div>
    </div>

    <!-- QR MODAL -->
    <div id="qrModal" class="modal-overlay" onclick="if(event.target===this) closeQR()">
      <div class="modal-content glass-strong fade-in-up" style="text-align:center; max-width:350px;">
        <h3 style="margin-bottom:16px;">QR Code</h3>
        <div id="qrCodeContainer" style="background:white; padding:16px; border-radius:12px; display:inline-block; margin-bottom:16px;"></div>
        <br><button class="btn-ghost" onclick="closeQR()">بستن</button>
      </div>
    </div>

    <footer class="footer">© 2024 Nebula Panels — طراحی شده با ✨</footer>
  `, `
    // Theme Toggle
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    }
    if(localStorage.getItem('theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');

    // Search
    document.getElementById('searchInput').addEventListener('input', function() {
      const q = this.value.toLowerCase();
      document.querySelectorAll('.card').forEach(card => {
        const name = card.dataset.name.toLowerCase();
        const tags = card.dataset.tags.toLowerCase();
        card.style.display = (name.includes(q) || tags.includes(q)) ? 'flex' : 'none';
      });
    });

    // Modal & Form Logic
    const modal = document.getElementById('modal');
    function openModal() { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
    function closeModal() { modal.classList.remove('active'); document.body.style.overflow = ''; }

    document.getElementById('expirySelect').addEventListener('change', function() {
      const wrap = document.getElementById('customWrap');
      if(this.value === 'custom') { wrap.style.display = 'block'; document.getElementById('customDays').required = true; } 
      else { wrap.style.display = 'none'; document.getElementById('customDays').required = false; }
    });

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if(fileInput.files[0]) document.getElementById('fileName').textContent = '📄 ' + fileInput.files[0].name; });
    ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
    dropzone.addEventListener('drop', e => { fileInput.files = e.dataTransfer.files; if(fileInput.files[0]) document.getElementById('fileName').textContent = '📄 ' + fileInput.files[0].name; });

    document.getElementById('uploadForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      btn.disabled = true; btn.textContent = 'در حال آپلود...';
      const result = document.getElementById('result');
      try {
        const res = await fetch('/upload', { method: 'POST', body: new FormData(this) });
        const data = await res.json();
        if(res.ok) { result.style.color = '#10b981'; result.textContent = '✅ پنل ساخته شد!'; setTimeout(() => location.reload(), 1500); } 
        else { result.style.color = '#ef4444'; result.textContent = data.error; btn.disabled = false; btn.textContent = 'آپلود و ساخت لینک 🚀'; }
      } catch(err) { result.style.color = '#ef4444'; result.textContent = 'خطای شبکه'; btn.disabled = false; btn.textContent = 'آپلود و ساخت لینک 🚀'; }
    });

    // API Actions
    async function togglePanel(id) { await fetch('/api/toggle/' + id, { method: 'POST' }); location.reload(); }
    async function extendPanel(id) { const d = prompt('چند روز تمدید شود؟', '30'); if(d && !isNaN(d)) { await fetch('/api/extend/' + id, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({days: parseInt(d)}) }); location.reload(); } }
    async function deletePanel(id) { if(confirm('آیا از حذف کامل این پنل اطمینان دارید؟')) { await fetch('/api/delete/' + id, { method: 'POST' }); location.reload(); } }

    // QR Code
    function showQR(url) {
      document.getElementById('qrModal').classList.add('active');
      document.getElementById('qrCodeContainer').innerHTML = '';
      new QRCode(document.getElementById('qrCodeContainer'), { text: url, width: 200, height: 200, colorDark: "#05030f", colorLight: "#ffffff" });
    }
    function closeQR() { document.getElementById('qrModal').classList.remove('active'); }
  `));
});

// --- UPLOAD ---
app.post('/upload', requireAuth, (req, res, next) => { 
  let slug = req.body.customSlug ? req.body.customSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '') : '';
  const db = getDB();
  if (slug && db.panels[slug]) return res.status(400).json({ error: 'این لینک دلخواه قبلاً استفاده شده است.' });
  req.panelId = slug || uuidv4();
  req.customFilename = req.panelId + '.html'; // Fix Slug Bug
  next(); 
}, upload.single('htmlFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایل انتخاب نشده' });
  const db = getDB();
  let days = req.body.expiry === 'custom' ? (parseInt(req.body.customDays) || 1) : (parseInt(req.body.expiry) || 30);
  let tags = req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(t => t) : [];

  db.panels[req.panelId] = {
    id: req.panelId, name: req.body.name || 'بدون نام', file: req.customFilename, days: days,
    created: new Date().toISOString(), expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(), 
    status: 'active', views: 0, password: req.body.panelPass || '', tags: tags
  };
  saveDB(db);
  res.json({ success: true });
});

// --- API ---
app.post('/api/toggle/:id', requireAuth, (req, res) => { const db = getDB(); if (db.panels[req.params.id]) { db.panels[req.params.id].status = db.panels[req.params.id].status === 'active' ? 'paused' : 'active'; saveDB(db); } res.json({ success: true }); });
app.post('/api/extend/:id', requireAuth, (req, res) => { const db = getDB(); const p = db.panels[req.params.id]; if (p && req.body.days) { p.expires = new Date((new Date(p.expires) > new Date() ? new Date(p.expires) : new Date()).getTime() + req.body.days * 86400000).toISOString(); if(p.status === 'paused') p.status = 'active'; saveDB(db); } res.json({ success: true }); });
app.post('/api/delete/:id', requireAuth, (req, res) => { const db = getDB(); const p = db.panels[req.params.id]; if (p) { if (fs.existsSync(path.join(UPLOAD_DIR, p.file))) fs.unlinkSync(path.join(UPLOAD_DIR, p.file)); delete db.panels[req.params.id]; saveDB(db); } res.json({ success: true }); });

// --- PUBLIC VIEW & PASSWORD PROTECT ---
app.get('/view/:id', (req, res) => {
  const db = getDB();
  const panel = db.panels[req.params.id];
  if (!panel) return res.status(404).send(renderError('پنل یافت نشد 🌌'));
  if (panel.status === 'paused') return res.status(403).send(renderError('این پنل متوقف شده است ⏸'));
  if (new Date() > new Date(panel.expires)) return res.status(403).send(renderError('زمان این پنل به پایان رسیده است ⏳'));

  if (panel.password && req.cookies[`panel_${panel.id}`] !== panel.password) {
    return res.send(renderLayout('ورود به پنل', `
      <div class="login-wrap">
        <div class="glass-strong login-card fade-in-up" style="text-align:center;">
          <div style="font-size:50px; margin-bottom:16px;">🔒</div>
          <h2 style="font-size:22px; font-weight:900; margin-bottom:8px;">${escapeHTML(panel.name)}</h2>
          <p style="opacity:.5; margin-bottom:24px; font-size:14px;">این لینک محافظت شده است. رمز عبور را وارد کنید.</p>
          ${req.query.err ? '<div class="error-box">رمز اشتباه است</div>' : ''}
          <form method="POST" action="/view/${panel.id}" class="stack">
            <input type="password" name="password" placeholder="رمز عبور" required class="input">
            <button class="btn-neon" type="submit">ورود</button>
          </form>
        </div>
      </div>
    `));
  }

  panel.views = (panel.views || 0) + 1;
  saveDB(db);
  res.sendFile(path.join(UPLOAD_DIR, panel.file));
});

app.post('/view/:id', (req, res) => {
  const db = getDB();
  const panel = db.panels[req.params.id];
  if (panel && panel.password === req.body.password) {
    res.cookie(`panel_${panel.id}`, panel.password, { maxAge: 900000, httpOnly: true });
    return res.redirect(`/view/${panel.id}`);
  }
  res.redirect(`/view/${panel.id}?err=1`);
});

// --- EDIT CODE ---
app.get('/edit/:id', requireAuth, (req, res) => { const db = getDB(); const p = db.panels[req.params.id]; if (!p) return res.redirect('/'); res.send(renderLayout('ویرایش', `<header class="glass header"><div class="header-inner"><div class="brand"><div class="logo-sm pulse-glow">✏️</div><div><div class="text-gradient" style="font-weight:900; font-size:18px;">ویرایش: ${escapeHTML(p.name)}</div></div></div><a href="/" class="btn-ghost">بازگشت</a></div></header><main><form method="POST" action="/edit/${req.params.id}" class="fade-in-up stack"><textarea name="code" class="code-editor glass">${escapeHTML(fs.readFileSync(path.join(UPLOAD_DIR, p.file), 'utf-8'))}</textarea><button class="btn-neon" type="submit">ذخیره تغییرات ✨</button></form></main>`)); });
app.post('/edit/:id', requireAuth, (req, res) => { const db = getDB(); const p = db.panels[req.params.id]; if (p) fs.writeFileSync(path.join(UPLOAD_DIR, p.file), req.body.code); res.redirect('/'); });

// --- UI HELPERS ---
function renderError(msg) { return renderLayout('خطا', `<div class="login-wrap"><div class="glass-strong login-card fade-in-up" style="text-align:center;"><div style="font-size:60px; margin-bottom:16px;">🚫</div><h2 style="font-size:24px; font-weight:900; margin-bottom:12px; color:#ef4444;">${msg}</h2><a href="/" class="btn-neon" style="display:inline-block; text-decoration:none; width:auto; padding:12px 24px;">بازگشت</a></div></div>`); }

function renderLayout(title, content, script = '') {
  return `<!DOCTYPE html><html lang="fa" dir="rtl" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Nebula</title><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"><script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script><style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#05030f;--text:#fff;--glass:rgba(255,255,255,.03);--glass-strong:rgba(15,15,25,.7);--line:rgba(255,255,255,.08);--muted:rgba(255,255,255,.5)}
[data-theme="light"]{--bg:#f8fafc;--text:#0f172a;--glass:rgba(255,255,255,.65);--glass-strong:rgba(255,255,255,.85);--line:rgba(0,0,0,.08);--muted:rgba(15,23,42,.5)}
body{font-family:'Vazirmatn',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;position:relative;transition:background .3s,color .3s}
.aurora{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.aurora::before,.aurora::after{content:"";position:absolute;width:70vmax;height:70vmax;border-radius:50%;filter:blur(120px);opacity:.55;animation:float 22s ease-in-out infinite}
.aurora::before{background:radial-gradient(circle at 30% 30%,#7c3aed 0%,transparent 60%);top:-20%;right:-10%}
.aurora::after{background:radial-gradient(circle at 70% 70%,#06b6d4 0%,transparent 60%);bottom:-20%;left:-10%;animation-delay:-11s}
.aurora-3{position:absolute;width:60vmax;height:60vmax;border-radius:50%;background:radial-gradient(circle at 50% 50%,#ec4899 0%,transparent 60%);top:30%;left:30%;filter:blur(140px);opacity:.35;animation:float 28s ease-in-out infinite -5s}
@keyframes float{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(5vw,-5vh) scale(1.1)}66%{transform:translate(-5vw,5vh) scale(.95)}}
.grid-bg{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(var(--line) 1px, transparent 1px),linear-gradient(90deg, var(--line) 1px, transparent 1px);background-size: 50px 50px;mask-image: radial-gradient(ellipse at center, black 20%, transparent 80%)}
.glass{background:var(--glass);backdrop-filter:blur(20px);border:1px solid var(--line)}
.glass-strong{background:var(--glass-strong);backdrop-filter:blur(30px);border:1px solid var(--line); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);}
.text-gradient{background:linear-gradient(135deg,#a78bfa 0%,#f0abfc 50%,#67e8f9 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.header{position:sticky;top:16px;z-index:50;margin:16px 24px 0;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.1)}
.header-inner{max-width:1200px;margin:0 auto;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
.brand{display:flex;align-items:center;gap:12px}
.logo-sm{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4);display:flex;align-items:center;justify-content:center}
.header-actions{display:flex;gap:12px;align-items:center}
main{position:relative;z-index:10;max-width:1200px;margin:0 auto;padding:32px 24px}
.hero-section{margin-bottom:40px}
.page-title{font-size:clamp(32px, 5vw, 48px);font-weight:900;line-height:1.1;margin-bottom:12px}
.page-subtitle{opacity:.6;font-size:18px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:40px}
.stat{border-radius:20px;padding:20px;transition:transform .3s}
.stat:hover{transform:translateY(-5px)}
.stat-icon{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:20px}
.stat-num{font-size:32px;font-weight:900;margin-bottom:4px}
.stat-label{font-size:13px;opacity:.5}
.section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px; flex-wrap:wrap; gap:12px;}
.section-title{font-size:24px;font-weight:800;display:flex;align-items:center;gap:12px}
.panels-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px}
.card{border-radius:24px;padding:24px;transition:all .3s;display:flex;flex-direction:column;gap:16px}
.card:hover{transform:translateY(-4px);border-color:rgba(124,58,237,.3)}
.card-header{display:flex;align-items:center;gap:16px}
.card-icon{width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#ec4899);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;flex-shrink:0}
.card-info{flex:1;min-width:0}
.card-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.card-title{font-weight:800;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-meta{font-size:12px;opacity:.5}
.badge{font-size:10px;font-weight:900;padding:4px 10px;border-radius:999px;display:inline-flex;align-items:center;gap:4px}
.tag-badge{font-size:10px;padding:2px 8px;border-radius:6px;background:rgba(124,58,237,.2);color:#c4b5fd}
.badge-html{background:rgba(236,72,153,.15);color:#f9a8d4}
.badge-success{background:rgba(16,185,129,.15);color:#6ee7b7}
.badge-warn{background:rgba(245,158,11,.15);color:#fcd34d}
.badge-danger{background:rgba(239,68,68,.15);color:#fca5a5}
.badge-ghost{background:rgba(255,255,255,.05);color:var(--muted);font-weight:400;font-size:13px}
.dot{width:6px;height:6px;border-radius:50%;background:#10b981;display:inline-block}
.card-stats{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.stat-box{display:flex;flex-direction:column;gap:4px}
.stat-label{font-size:11px;opacity:.5}
.stat-value{font-size:15px;font-weight:700}
.card-actions{display:flex;gap:8px;align-items:center; flex-wrap: wrap;}
.action-btn{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;transition:all .2s;font-size:16px}
.action-btn:hover{background:rgba(124,58,237,.2);border-color:rgba(124,58,237,.4)}
.delete-btn:hover{background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.4);color:#fca5a5}
.toggle{width:52px;height:28px;border-radius:999px;background:rgba(255,255,255,.1);position:relative;cursor:pointer;transition:all .3s;border:1px solid var(--line)}
.toggle.active{background:linear-gradient(90deg,#10b981,#06b6d4);box-shadow:0 0 15px rgba(16,185,129,.4);border-color:transparent}
.toggle-thumb{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3);transition:all .3s cubic-bezier(.68,-.55,.27,1.55)}
.toggle.active .toggle-thumb{right:27px}
.card-url{background:rgba(0,0,0,.2);border:1px solid var(--line);border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:10px}
.url-text{font-family:monospace;font-size:12px;opacity:.7;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btn-neon{position:relative;overflow:hidden;background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;font-weight:800;border:0;padding:14px 24px;border-radius:14px;font-family:inherit;cursor:pointer;transition:all .3s;font-size:15px;box-shadow:0 10px 25px rgba(124,58,237,.3)}
.btn-neon:hover{transform:translateY(-2px);box-shadow:0 15px 35px rgba(124,58,237,.5)}
.btn-neon:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-ghost{background:rgba(255,255,255,.05);color:var(--text);font-weight:700;border:1px solid var(--line);padding:10px 16px;border-radius:12px;font-family:inherit;cursor:pointer;transition:all .2s;text-decoration:none;text-align:center;font-size:14px}
.btn-ghost:hover{background:rgba(124,58,237,.1);border-color:rgba(124,58,237,.3)}
.input{width:100%;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:14px;padding:14px 16px;color:var(--text);font-family:inherit;outline:none;transition:all .2s}
.input:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.2)}
select.input{cursor:pointer} option{background:#1e1b4b;color:#fff}
.stack{display:grid;gap:16px}
.dropzone{border:2px dashed var(--line);border-radius:20px;padding:30px;text-align:center;cursor:pointer;transition:all .3s;background:rgba(255,255,255,.02)}
.dropzone:hover,.dropzone.dragover{border-color:#ec4899;background:rgba(236,72,153,.05)}
.drop-ico{font-size:48px;margin-bottom:12px}
.drop-title{font-weight:800;font-size:18px;margin-bottom:6px}
.file-name{color:#67e8f9;font-size:13px;font-weight:700;min-height:20px}
.modal-overlay{position:fixed;inset:0;background:rgba(5,3,15,.8);backdrop-filter:blur(10px);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .3s}
.modal-overlay.active{opacity:1;pointer-events:auto}
.modal-content{width:100%;max-width:500px;border-radius:28px;padding:32px;transform:translateY(20px) scale(.95);transition:transform .4s}
.modal-overlay.active .modal-content{transform:translateY(0) scale(1)}
.modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
.empty-state{grid-column:1/-1;padding:60px 20px;text-align:center;border-radius:24px}
.login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.login-card{width:100%;max-width:420px;padding:40px;border-radius:28px;text-align:center}
.logo-wrap{width:70px;height:70px;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4);display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
.error-box{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:12px;border-radius:12px;margin-bottom:16px;font-size:14px}
.code-editor{width:100%;height:65vh;background:rgba(0,0,0,.4);border:1px solid var(--line);border-radius:16px;color:#a5f3fc;padding:20px;font-family:monospace;font-size:14px;outline:none;resize:vertical;direction:ltr;text-align:left}
@keyframes fade-in-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.fade-in-up{animation:fade-in-up .6s ease forwards}
@keyframes float-y{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.float-y{animation:float-y 4s ease-in-out infinite}
@keyframes pulse-glow{0%,100%{box-shadow:0 0 20px rgba(124,58,237,.4),0 0 40px rgba(236,72,153,.2)}50%{box-shadow:0 0 40px rgba(124,58,237,.7),0 0 80px rgba(236,72,153,.4)}}
.pulse-glow{animation:pulse-glow 3s ease-in-out infinite}
.shine{position:relative;overflow:hidden}
.shine::after{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.05),transparent);transition:left .8s ease}
.shine:hover::after{left:100%}
.footer{text-align:center;padding:40px 0;opacity:.3;font-size:12px;position:relative;z-index:10}
::-webkit-scrollbar{width:10px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#7c3aed,#ec4899);border-radius:10px}
@media(max-width:768px){.header-inner{flex-direction:column;gap:16px}.header-actions{width:100%;justify-content:center}.card-stats{flex-direction:column;align-items:flex-start}.card-actions{width:100%;justify-content:flex-start}}
</style></head><body><div class="aurora"><div class="aurora-3"></div></div><div class="grid-bg"></div>${content}<script>${script}</script></body></html>`;
}

app.listen(PORT, () => console.log('Nebula Ultra running on ' + PORT));
