const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_PATH = path.join(__dirname, 'db.json');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ panels: {} }));

const getDB = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const saveDB = (db) => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

app.use(session({
  secret: process.env.SESSION_SECRET || 'nebula-secret-key',
  resave: false, saveUninitialized: false,
  cookie: { secure: 'auto', maxAge: 24 * 60 * 60 * 1000 }
}));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, req.panelId + '.html')
});
const upload = multer({ storage });

// --- AUTH ---
const requireAuth = (req, res, next) => req.session.auth ? next() : res.redirect('/login');

app.get('/login', (req, res) => {
  if (req.session.auth) return res.redirect('/');
  res.send(renderLayout('ورود', `
    <div class="login-wrap">
      <div class="glass-strong login-card fade-in-up">
        <div class="brand" style="justify-content:center; margin-bottom:24px;">
          <div class="logo">🌌</div>
          <div><h1 style="font-size:22px;">Nebula Panels</h1><p>پنل‌ساز ابری</p></div>
        </div>
        ${req.query.err ? '<div class="error">رمز عبور اشتباه است</div>' : ''}
        <form method="POST" action="/login" class="stack">
          <input class="input" type="password" name="password" placeholder="رمز عبور" required />
          <button class="btn" type="submit">ورود به داشبورد</button>
        </form>
      </div>
    </div>
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

  res.send(renderLayout('داشبورد', `
    <header class="header glass fade-in-up">
      <div class="brand"><div class="logo">🌌</div><div><h1>Nebula Panels</h1><p>پنل‌ساز حرفه‌ای</p></div></div>
      <a class="pill" href="/logout">خروج</a>
    </header>

    <section class="stats fade-in-up">
      <div class="stat glass shine"><div class="icon">📄</div><div class="num">${panels.length}</div><div class="label">کل پنل‌ها</div></div>
      <div class="stat glass shine"><div class="icon">🚀</div><div class="num">${activeCount}</div><div class="label">فعال</div></div>
      <div class="stat glass shine"><div class="icon">⏳</div><div class="num">${expiredCount}</div><div class="label">منقضی</div></div>
    </section>

    <section class="hero glass-strong fade-in-up" style="margin-bottom:30px;">
      <h2 style="margin:0 0 16px; font-size:24px;">ساخت پنل جدید ✨</h2>
      <form id="uploadForm" enctype="multipart/form-data" class="stack">
        <div class="dropzone" id="dropzone">
          <div class="drop-ico">☁️</div>
          <div class="drop-title">فایل HTML را انتخاب کنید</div>
          <div class="file-name" id="fileName"></div>
          <input type="file" id="fileInput" name="htmlFile" accept=".html" hidden required />
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <input class="input" type="text" name="name" placeholder="نام پنل (مثلا: سایت من)" required />
          <select class="input" name="expiry" required>
            <option value="1">1 روز</option>
            <option value="7">7 روز</option>
            <option value="30" selected>1 ماه</option>
            <option value="365">1 سال</option>
          </select>
        </div>
        <button class="btn" id="uploadBtn" type="submit">آپلود و ساخت لینک</button>
      </form>
      <div class="result" id="result"></div>
    </section>

    <section class="fade-in-up">
      <h2 style="margin:0 0 16px; font-size:24px;">پنل‌های من</h2>
      <div class="panels-grid">
        ${panels.length === 0 ? '<div class="glass" style="padding:40px; text-align:center; border-radius:20px; grid-column:1/-1;">هنوز پنلی نساخته‌اید 🌌</div>' : ''}
        ${panels.map(p => {
          const isExpired = new Date(p.expires) <= new Date();
          const isPaused = p.status === 'paused';
          const statusClass = isExpired ? 'expired' : (isPaused ? 'paused' : 'active');
          const statusText = isExpired ? 'منقضی شده' : (isPaused ? 'متوقف شده' : 'فعال');
          const url = `${req.protocol}://${req.get('host')}/view/${p.id}`;
          return `
            <div class="panel-card glass shine">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; font-size:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</h3>
                <span class="badge ${statusClass}">${statusText}</span>
              </div>
              <div class="meta">ساخت: ${new Date(p.created).toLocaleDateString('fa-IR')}</div>
              <div class="meta">انقضا: ${new Date(p.expires).toLocaleDateString('fa-IR')}</div>
              <div class="actions">
                <button class="btn-sm" onclick="togglePanel('${p.id}')">${isPaused ? 'وصل' : 'قطع'}</button>
                <button class="btn-sm" onclick="extendPanel('${p.id}')">تمدید</button>
                <a href="/edit/${p.id}" class="btn-sm">ویرایش کد</a>
                <button class="btn-sm copy-link" data-url="${url}">لینک</button>
              </div>
            </div>`;
        }).join('')}
      </div>
    </section>
  `, `
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    document.getElementById('dropzone').onclick = () => fileInput.click();
    fileInput.onchange = () => document.getElementById('fileName').textContent = fileInput.files[0]?.name || '';

    document.getElementById('uploadForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('uploadBtn');
      btn.disabled = true; btn.textContent = 'در حال آپلود...';
      const fd = new FormData(e.target);
      const res = await fetch('/upload', { method: 'POST', body: fd });
      const data = await res.json();
      const result = document.getElementById('result');
      if(res.ok) {
        result.className = 'result show success';
        result.innerHTML = '✅ پنل ساخته شد! صفحه رفرش می‌شود...';
        setTimeout(() => location.reload(), 1500);
      } else {
        result.className = 'result show error';
        result.innerHTML = data.error;
        btn.disabled = false; btn.textContent = 'آپلود و ساخت لینک';
      }
    };

    document.querySelectorAll('.copy-link').forEach(btn => {
      btn.onclick = () => { navigator.clipboard.writeText(btn.dataset.url); alert('لینک کپی شد!'); }
    });

    async function togglePanel(id) {
      await fetch('/api/toggle/' + id, { method: 'POST' });
      location.reload();
    }

    async function extendPanel(id) {
      const days = prompt('چند روز تمدید شود؟ (مثلا 30)', '30');
      if(days && !isNaN(days)) {
        await fetch('/api/extend/' + id, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({days: parseInt(days)}) });
        location.reload();
      }
    }
  `));
});

// --- UPLOAD ---
app.post('/upload', requireAuth, (req, res, next) => {
  req.panelId = uuidv4();
  next();
}, upload.single('htmlFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایل انتخاب نشده' });
  const db = getDB();
  const days = parseInt(req.body.expiry) || 30;
  db.panels[req.panelId] = {
    id: req.panelId,
    name: req.body.name || 'بدون نام',
    file: req.panelId + '.html',
    created: new Date().toISOString(),
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  };
  saveDB(db);
  res.json({ success: true });
});

// --- PUBLIC VIEW ---
app.get('/view/:id', (req, res) => {
  const db = getDB();
  const panel = db.panels[req.params.id];
  if (!panel) return res.status(404).send(renderError('پنل یافت نشد'));
  if (panel.status === 'paused') return res.status(403).send(renderError('این پنل توسط مدیر متوقف شده است'));
  if (new Date() > new Date(panel.expires)) return res.status(403).send(renderError('زمان این پنل به پایان رسیده است ⏳'));
  res.sendFile(path.join(UPLOAD_DIR, panel.file));
});

// --- EDIT CODE ---
app.get('/edit/:id', requireAuth, (req, res) => {
  const db = getDB();
  const panel = db.panels[req.params.id];
  if (!panel) return res.redirect('/');
  const code = fs.readFileSync(path.join(UPLOAD_DIR, panel.file), 'utf-8');
  res.send(renderLayout('ویرایش کد', `
    <header class="header glass fade-in-up">
      <div class="brand"><div class="logo">💻</div><div><h1>ویرایش: ${panel.name}</h1></div></div>
      <a class="pill" href="/">بازگشت</a>
    </header>
    <form method="POST" action="/edit/${req.params.id}" class="fade-in-up">
      <textarea name="code" class="code-editor glass">${code}</textarea>
      <button class="btn" type="submit" style="margin-top:16px;">ذخیره تغییرات</button>
    </form>
  `));
});

app.post('/edit/:id', requireAuth, (req, res) => {
  const db = getDB();
  const panel = db.panels[req.params.id];
  if (panel) {
    fs.writeFileSync(path.join(UPLOAD_DIR, panel.file), req.body.code);
  }
  res.redirect('/');
});

// --- API ACTIONS ---
app.post('/api/toggle/:id', requireAuth, (req, res) => {
  const db = getDB();
  if (db.panels[req.params.id]) {
    db.panels[req.params.id].status = db.panels[req.params.id].status === 'active' ? 'paused' : 'active';
    saveDB(db);
  }
  res.json({ success: true });
});

app.post('/api/extend/:id', requireAuth, (req, res) => {
  const db = getDB();
  const panel = db.panels[req.params.id];
  if (panel && req.body.days) {
    const baseDate = new Date(panel.expires) > new Date() ? new Date(panel.expires) : new Date();
    panel.expires = new Date(baseDate.getTime() + req.body.days * 24 * 60 * 60 * 1000).toISOString();
    if(panel.status === 'paused') panel.status = 'active';
    saveDB(db);
  }
  res.json({ success: true });
});

// --- UI HELPERS ---
function renderError(msg) {
  return renderLayout('خطا', `
    <div class="login-wrap">
      <div class="glass-strong login-card fade-in-up" style="text-align:center;">
        <div style="font-size:60px; margin-bottom:16px;">🚫</div>
        <h2 style="margin:0 0 12px;">${msg}</h2>
        <a href="/" class="btn" style="display:inline-block; text-decoration:none; width:auto; padding:12px 24px;">بازگشت</a>
      </div>
    </div>
  `);
}

function renderLayout(title, content, script = '') {
  return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title} | Nebula</title>
  <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
  <style>
    :root{--bg:#05030f;--glass:rgba(255,255,255,.05);--glass-strong:rgba(255,255,255,.08);--line:rgba(255,255,255,.1);--text:#f8fafc;--muted:rgba(255,255,255,.6);--accent:#7c3aed;--cyan:#22d3ee;--success:#10b981;--danger:#ef4444;--warn:#f59e0b;}
    *{box-sizing:border-box; margin:0; padding:0;}
    body{font-family:'Vazirmatn',system-ui,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; overflow-x:hidden;}
    .aurora{position:fixed; inset:-20%; pointer-events:none; z-index:0; filter:blur(80px); opacity:.6;}
    .aurora::before,.aurora::after{content:""; position:absolute; border-radius:999px;}
    .aurora::before{width:500px; height:500px; left:10%; top:5%; background:radial-gradient(circle,rgba(124,58,237,.5),transparent 70%); animation:float 12s infinite;}
    .aurora::after{width:600px; height:600px; right:5%; bottom:5%; background:radial-gradient(circle,rgba(34,211,238,.4),transparent 70%); animation:float 15s infinite reverse;}
    @keyframes float{0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-30px)}}
    .shell{position:relative; z-index:1; max-width:1200px; margin:0 auto; padding:20px;}
    .glass{background:var(--glass); border:1px solid var(--line); backdrop-filter:blur(16px); border-radius:20px;}
    .glass-strong{background:var(--glass-strong); border:1px solid rgba(255,255,255,.15); backdrop-filter:blur(24px); border-radius:24px;}
    .header{display:flex; justify-content:space-between; align-items:center; padding:16px 20px; margin-bottom:24px;}
    .brand{display:flex; align-items:center; gap:12px;}
    .logo{width:44px; height:44px; border-radius:14px; background:linear-gradient(135deg,var(--accent),var(--cyan)); display:grid; place-items:center; font-size:22px;}
    h1{font-size:18px; font-weight:900;}
    .brand p{font-size:12px; color:var(--muted);}
    .pill{background:rgba(255,255,255,.08); border:1px solid var(--line); padding:8px 16px; border-radius:99px; color:var(--text); text-decoration:none; font-size:13px; transition:.2s;}
    .pill:hover{background:rgba(255,255,255,.15);}
    .stats{display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin-bottom:24px;}
    .stat{padding:20px; position:relative; overflow:hidden;}
    .stat .icon{width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,var(--accent),#d946ef); display:grid; place-items:center; margin-bottom:12px;}
    .stat:nth-child(2) .icon{background:linear-gradient(135deg,var(--cyan),#06b6d4);}
    .stat:nth-child(3) .icon{background:linear-gradient(135deg,var(--warn),#ea580c);}
    .stat .num{font-size:28px; font-weight:900;}
    .stat .label{font-size:12px; color:var(--muted);}
    .hero{padding:24px; margin-bottom:24px;}
    .stack{display:grid; gap:14px;}
    .input, select.input{background:rgba(255,255,255,.06); border:1px solid var(--line); border-radius:14px; padding:14px; color:white; font-family:inherit; outline:none;}
    .input:focus{border-color:var(--cyan); box-shadow:0 0 0 3px rgba(34,211,238,.15);}
    .btn{background:linear-gradient(135deg,var(--accent),#d946ef,var(--cyan)); border:none; color:white; padding:14px; border-radius:14px; font-weight:800; cursor:pointer; font-family:inherit; transition:.2s;}
    .btn:hover{transform:translateY(-2px); box-shadow:0 10px 20px rgba(124,58,237,.3);}
    .btn:disabled{opacity:.5; cursor:not-allowed; transform:none;}
    .dropzone{border:2px dashed rgba(255,255,255,.2); border-radius:20px; padding:30px; text-align:center; cursor:pointer; transition:.2s;}
    .dropzone:hover{border-color:var(--cyan); background:rgba(34,211,238,.05);}
    .drop-ico{font-size:40px; margin-bottom:10px;}
    .drop-title{font-weight:700; margin-bottom:6px;}
    .file-name{color:var(--cyan); font-size:13px; min-height:20px;}
    .result{display:none; margin-top:16px; padding:14px; border-radius:14px; text-align:center;}
    .result.show{display:block;}
    .result.success{background:rgba(16,185,129,.15); border:1px solid rgba(16,185,129,.3); color:#6ee7b7;}
    .result.error{background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.3); color:#fca5a5;}
    .panels-grid{display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px;}
    .panel-card{padding:20px; display:flex; flex-direction:column; gap:10px;}
    .badge{padding:4px 10px; border-radius:99px; font-size:11px; font-weight:700;}
    .badge.active{background:rgba(16,185,129,.2); color:#6ee7b7;}
    .badge.paused{background:rgba(245,158,11,.2); color:#fcd34d;}
    .badge.expired{background:rgba(239,68,68,.2); color:#fca5a5;}
    .meta{font-size:12px; color:var(--muted);}
    .actions{display:flex; gap:8px; flex-wrap:wrap; margin-top:auto; padding-top:10px; border-top:1px solid var(--line);}
    .btn-sm{background:rgba(255,255,255,.08); border:1px solid var(--line); color:white; padding:6px 12px; border-radius:10px; font-size:12px; cursor:pointer; text-decoration:none; transition:.2s;}
    .btn-sm:hover{background:rgba(255,255,255,.15);}
    .login-wrap{min-height:100vh; display:grid; place-items:center; padding:20px;}
    .login-card{width:100%; max-width:420px; padding:30px;}
    .error{background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.3); color:#fca5a5; padding:12px; border-radius:12px; margin-bottom:16px; text-align:center; font-size:14px;}
    .code-editor{width:100%; height:60vh; background:rgba(0,0,0,.4); border:1px solid var(--line); border-radius:16px; color:#a5f3fc; padding:20px; font-family:monospace; font-size:14px; outline:none; resize:vertical; direction:ltr; text-align:left;}
    .fade-in-up{animation:fadeUp .5s ease both;}
    @keyframes fadeUp{from{opacity:0; transform:translateY(20px)} to{opacity:1; transform:translateY(0)}}
    .shine{position:relative; overflow:hidden;}
    .shine::after{content:""; position:absolute; inset:-50%; background:linear-gradient(120deg,transparent 40%,rgba(255,255,255,.05) 50%,transparent 60%); transform:translateX(-100%) rotate(25deg); transition:.6s;}
    .shine:hover::after{transform:translateX(100%) rotate(25deg);}
  </style></head><body>
  <div class="aurora"></div>
  <main class="shell">${content}</main>
  <script>${script}</script></body></html>`;
}

app.listen(PORT, () => console.log('Nebula Panels running on ' + PORT));
