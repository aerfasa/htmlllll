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

// --- HELPERS ---
const requireAuth = (req, res, next) => req.session.auth ? next() : res.redirect('/login');

function formatDate(iso) { return new Date(iso).toLocaleDateString('fa-IR'); }
function getTimeRemaining(iso) {
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return 'پایان زمان';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days} روز و ${hours} ساعت`;
}
function escapeHTML(str) { return str.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// --- AUTH ---
app.get('/login', (req, res) => {
  if (req.session.auth) return res.redirect('/');
  res.send(renderLayout('ورود', `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px;">
      <div class="glass-strong fade-in-up" style="width:100%; max-width:420px; padding:40px; border-radius:24px; text-align:center;">
        <div style="width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4);display:flex;align-items:center;justify-content:center; margin: 0 auto 20px;" class="pulse-glow">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <h2 style="font-size:24px; font-weight:900; margin-bottom:8px;" class="text-gradient">Nebula Panels</h2>
        <p style="opacity:.5; margin-bottom:24px; font-size:14px;">برای ورود به داشبورد رمز عبور را وارد کنید</p>
        ${req.query.err ? '<div style="background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.3); color:#fca5a5; padding:10px; border-radius:10px; margin-bottom:16px; font-size:13px;">رمز عبور اشتباه است</div>' : ''}
        <form method="POST" action="/login">
          <input type="password" name="password" placeholder="رمز عبور" required style="width:100%; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#fff; padding:14px; border-radius:12px; font-family:inherit; outline:none; margin-bottom:16px; text-align:center; letter-spacing:2px;">
          <button class="glow-btn" type="submit" style="background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;font-weight:800;border:0;padding:14px 20px;border-radius:12px;font-family:inherit;cursor:pointer; width:100%;">ورود به پنل ✨</button>
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
  const pausedCount = panels.filter(p => p.status === 'paused').length;

  const panelsHTML = panels.length === 0 
    ? '<div class="glass" style="padding:40px; text-align:center; border-radius:20px; opacity:.6;">هنوز پنلی نساخته‌اید 🌌</div>'
    : panels.map(p => {
        const isExpired = new Date(p.expires) <= new Date();
        const isPaused = p.status === 'paused';
        let statusBadge = '';
        let toggleBg = 'rgba(255,255,255,.1)';
        let toggleRight = '24px';

        if (isExpired) {
            statusBadge = `<span class="badge" style="background:rgba(239,68,68,.2);color:#fca5a5">⏰ منقضی</span>`;
        } else if (isPaused) {
            statusBadge = `<span class="badge" style="background:rgba(251,191,36,.2);color:#fde68a">⏸ متوقف</span>`;
        } else {
            statusBadge = `<span class="badge" style="background:rgba(16,185,129,.2);color:#6ee7b7;display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;display:inline-block"></span> فعال</span>`;
            toggleBg = 'linear-gradient(90deg,#10b981,#06b6d4)';
            toggleRight = '2px';
        }

        const url = `${req.protocol}://${req.get('host')}/view/${p.id}`;
        return `
        <div class="glass card shine fade-in-up">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#ec4899);display:flex;align-items:center;justify-content:center;font-weight:900">＜＞</div>
            <div style="flex:1;min-width:200px">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                <span style="font-weight:800;font-size:18px">${escapeHTML(p.name)}</span>
                <span class="badge" style="background:rgba(236,72,153,.2);color:#f9a8d4">HTML</span>
                ${statusBadge}
              </div>
              <div style="font-size:12px;opacity:.5">ساخت: ${formatDate(p.created)} • مدت: ${p.days} روز</div>
            </div>
            <div style="min-width:120px">
               <div style="font-size:11px;opacity:.5;margin-bottom:4px">${isExpired ? 'وضعیت' : 'زمان باقی‌مانده'}</div>
               <div style="font-size:14px;font-weight:700;color:${isExpired ? '#fca5a5' : '#6ee7b7'}">${isExpired ? 'پایان زمان' : getTimeRemaining(p.expires)}</div>
            </div>
            <div style="display:flex;gap:8px; align-items: center;">
              <button class="action-btn" onclick="navigator.clipboard.writeText('${url}'); alert('لینک کپی شد!');">📋</button>
              <a href="${url}" target="_blank" class="action-btn">↗</a>
              <a href="/edit/${p.id}" class="action-btn">✏️</a>
              <div class="toggle" onclick="togglePanel('${p.id}')" style="background:${toggleBg}"><div class="toggle-thumb" style="right:${toggleRight}"></div></div>
            </div>
          </div>
          <div style="margin-top:16px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:10px 14px;display:flex;align-items:center;gap:8px">
            <span style="opacity:.4">🔗</span><span style="font-family:monospace;font-size:12px;opacity:.7;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" dir="ltr">${url}</span>
          </div>
          <div style="margin-top:12px;">
             <button class="glow-btn" onclick="extendPanel('${p.id}')" style="background:rgba(255,255,255,.05);color:#fff;font-weight:700;border:1px solid rgba(255,255,255,.1);padding:8px 14px;border-radius:10px;font-family:inherit;cursor:pointer; font-size:12px;">تمدید زمان ⏳</button>
          </div>
        </div>`;
    }).join('');

  res.send(renderLayout('داشبورد', `
    <header class="glass" style="border-bottom:1px solid rgba(255,255,255,.05);backdrop-filter:blur(24px);position:sticky;top:0; z-index: 50;">
      <div style="max-width:1200px;margin:0 auto;padding:16px 24px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4);display:flex;align-items:center;justify-content:center" class="pulse-glow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div><div style="font-weight:900;font-size:18px" class="text-gradient">Nebula Panels</div><div style="font-size:11px;opacity:.4">پنل‌ساز ابری</div></div>
        </div>
        <div style="display:flex; gap:10px;">
          <a href="#uploadForm" class="glow-btn" style="background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;font-weight:800;border:0;padding:10px 20px;border-radius:12px;font-family:inherit;cursor:pointer; text-decoration:none;">✨ ساخت پنل جدید</a>
          <a href="/logout" style="background:rgba(255,255,255,.05);color:#fff;font-weight:700;border:1px solid rgba(255,255,255,.1);padding:10px 20px;border-radius:12px;font-family:inherit;cursor:pointer; text-decoration:none; font-size:14px;">خروج</a>
        </div>
      </div>
    </header>

    <main>
      <section class="fade-in-up">
        <h1 style="font-size:48px;font-weight:900;line-height:1.1;margin-bottom:12px">خوش آمدی به <span class="text-gradient">داشبورد</span> ✨</h1>
        <p style="opacity:.6;font-size:18px">فایل‌های HTML خودت رو آپلود کن و در چند ثانیه لینک اختصاصی دریافت کن.</p>
      </section>

      <section class="stats fade-in-up" style="animation-delay:.1s">
        <div class="glass stat shine"><div class="stat-icon" style="background:linear-gradient(135deg,#8b5cf6,#ec4899)">📊</div><div style="font-size:28px;font-weight:900">${panels.length}</div><div style="font-size:12px;opacity:.5">کل پنل‌ها</div></div>
        <div class="glass stat shine"><div class="stat-icon" style="background:linear-gradient(135deg,#10b981,#06b6d4)">✅</div><div style="font-size:28px;font-weight:900">${activeCount}</div><div style="font-size:12px;opacity:.5">فعال</div></div>
        <div class="glass stat shine"><div class="stat-icon" style="background:linear-gradient(135deg,#fb923c,#ec4899)">⏰</div><div style="font-size:28px;font-weight:900">${expiredCount}</div><div style="font-size:12px;opacity:.5">منقضی</div></div>
        <div class="glass stat shine"><div class="stat-icon" style="background:linear-gradient(135deg,#f87171,#ef4444)">⛔</div><div style="font-size:28px;font-weight:900">${pausedCount}</div><div style="font-size:12px;opacity:.5">متوقف</div></div>
      </section>

      <form id="uploadForm" enctype="multipart/form-data" class="glass-strong card shine fade-in-up" style="padding:32px;display:flex;flex-direction:column;gap:20px;">
        <div style="display:flex;align-items:center;gap:24px; flex-wrap: wrap;">
          <div style="width:80px;height:80px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#ec4899,#ec4899);display:flex;align-items:center;justify-content:center" class="float-y">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          </div>
          <div style="flex:1; min-width: 250px;">
            <h3 style="font-size:22px;font-weight:800;margin-bottom:6px">آپلود فایل جدید</h3>
            <p style="opacity:.6; margin-bottom:15px;">فایل HTML انتخاب کن — مدت زمان فعال بودن را مشخص کن — لینک اختصاصی دریافت کن.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <input type="text" name="name" placeholder="نام پنل (مثلا: سایت من)" required style="background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#fff; padding:12px 14px; border-radius:10px; font-family:inherit; outline:none;">
              <select name="expiry" required style="background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#fff; padding:12px 14px; border-radius:10px; font-family:inherit; outline:none;">
                <option value="1">1 روز</option>
                <option value="7">7 روز</option>
                <option value="30" selected>1 ماه</option>
                <option value="365">1 سال</option>
              </select>
            </div>
          </div>
        </div>
        <label class="glow-btn" style="background:linear-gradient(90deg,#7c3aed,#ec4899);color:#fff;font-weight:800;border:0;padding:14px 20px;border-radius:12px;font-family:inherit;cursor:pointer; text-align:center;">
          انتخاب فایل و آپلود ✨
          <input type="file" name="htmlFile" accept=".html" required style="display:none;" id="fileInput">
        </label>
        <div id="fileName" style="font-size:12px; opacity:.6; text-align:center;"></div>
        <div id="result" style="text-align:center; font-weight:700;"></div>
      </form>

      <section class="fade-in-up" style="animation-delay:.2s">
        <h3 style="font-size:24px;font-weight:800;margin:40px 0 16px"><span class="text-gradient">پنل‌های من</span> <span style="font-size:14px;font-weight:400;opacity:.4;background:rgba(255,255,255,.05);padding:4px 12px;border-radius:999px">${panels.length} پنل</span></h3>
        ${panelsHTML}
      </section>

      <section style="text-align:center;padding:40px 0;opacity:.3;font-size:12px">
        © 2024 Nebula Panels — طراحی شده با ✨
      </section>
    </main>
  `, `
    document.getElementById('fileInput').addEventListener('change', function() {
      document.getElementById('fileName').textContent = this.files[0] ? '📄 ' + this.files[0].name : '';
    });

    document.getElementById('uploadForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = this.querySelector('label');
      btn.innerHTML = 'در حال آپلود...';
      btn.style.pointerEvents = 'none';
      const formData = new FormData(this);
      try {
        const res = await fetch('/upload', { method: 'POST', body: formData });
        const data = await res.json();
        const result = document.getElementById('result');
        if(res.ok) {
          result.style.color = '#6ee7b7';
          result.textContent = '✅ پنل با موفقیت ساخته شد!';
          setTimeout(() => location.reload(), 1500);
        } else {
          result.style.color = '#fca5a5';
          result.textContent = data.error || 'خطا در آپلود';
          btn.innerHTML = 'انتخاب فایل و آپلود ✨';
          btn.style.pointerEvents = 'auto';
        }
      } catch(err) {
        document.getElementById('result').textContent = 'خطای شبکه';
        btn.innerHTML = 'انتخاب فایل و آپلود ✨';
        btn.style.pointerEvents = 'auto';
      }
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

// --- UPLOAD & API ---
app.post('/upload', requireAuth, (req, res, next) => { req.panelId = uuidv4(); next(); }, upload.single('htmlFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'فایل انتخاب نشده' });
  const db = getDB();
  const days = parseInt(req.body.expiry) || 30;
  db.panels[req.panelId] = {
    id: req.panelId, name: req.body.name || 'بدون نام', file: req.panelId + '.html', days: days,
    created: new Date().toISOString(), expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(), status: 'active'
  };
  saveDB(db);
  res.json({ success: true });
});

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

// --- PUBLIC VIEW ---
app.get('/view/:id', (req, res) => {
  const db = getDB();
  const panel = db.panels[req.params.id];
  if (!panel) return res.status(404).send(renderError('پنل یافت نشد'));
  if (panel.status === 'paused') return res.status(403).send(renderError('این پنل توسط مدیر متوقف شده است ⏸'));
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
    <header class="glass" style="border-bottom:1px solid rgba(255,255,255,.05);backdrop-filter:blur(24px);position:sticky;top:0; z-index: 50;">
      <div style="max-width:1200px;margin:0 auto;padding:16px 24px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4);display:flex;align-items:center;justify-content:center" class="pulse-glow">✏️</div>
          <div><div style="font-weight:900;font-size:18px" class="text-gradient">ویرایش: ${escapeHTML(panel.name)}</div></div>
        </div>
        <a href="/" style="background:rgba(255,255,255,.05);color:#fff;font-weight:800;border:1px solid rgba(255,255,255,.1);padding:10px 20px;border-radius:12px;font-family:inherit;cursor:pointer; text-decoration:none;">بازگشت</a>
      </div>
    </header>
    <main>
      <form method="POST" action="/edit/${req.params.id}" class="fade-in-up">
        <textarea name="code" style="width:100%; height:65vh; background:rgba(0,0,0,.4); border:1px solid rgba(255,255,255,.1); border-radius:16px; color:#a5f3fc; padding:20px; font-family:monospace; font-size:14px; outline:none; resize:vertical; direction:ltr; text-align:left; margin-bottom:20px;">${escapeHTML(code)}</textarea>
        <button class="glow-btn" type="submit" style="background:linear-gradient(90deg,#10b981,#06b6d4);color:#fff;font-weight:800;border:0;padding:14px 28px;border-radius:12px;font-family:inherit;cursor:pointer; width: 100%; font-size: 16px;">ذخیره تغییرات ✨</button>
      </form>
    </main>
  `));
});

app.post('/edit/:id', requireAuth, (req, res) => {
  const db = getDB();
  const panel = db.panels[req.params.id];
  if (panel) fs.writeFileSync(path.join(UPLOAD_DIR, panel.file), req.body.code);
  res.redirect('/');
});

// --- UI HELPERS ---
function renderError(msg) {
  return renderLayout('خطا', `
    <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px;">
      <div class="glass-strong fade-in-up" style="width:100%; max-width:420px; padding:40px; border-radius:24px; text-align:center;">
        <div style="font-size:50px; margin-bottom:16px;">🚫</div>
        <h2 style="font-size:22px; font-weight:900; margin-bottom:12px; color:#fca5a5;">${msg}</h2>
        <p style="opacity:.5; font-size:14px;">لطفا با مدیر سیستم تماس بگیرید.</p>
      </div>
    </div>
  `);
}

function renderLayout(title, content, script = '') {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Nebula Panels</title>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{color-scheme:dark}
body{font-family:'Vazirmatn',system-ui,sans-serif;background:#05030f;color:#fff;min-height:100vh;overflow-x:hidden;position:relative}
.aurora{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.aurora::before,.aurora::after{content:"";position:absolute;width:70vmax;height:70vmax;border-radius:50%;filter:blur(120px);opacity:.55;animation:float 22s ease-in-out infinite}
.aurora::before{background:radial-gradient(circle at 30% 30%,#7c3aed 0%,transparent 60%);top:-20%;right:-10%}
.aurora::after{background:radial-gradient(circle at 70% 70%,#06b6d4 0%,transparent 60%);bottom:-20%;left:-10%;animation-delay:-11s}
.aurora-3{position:absolute;width:60vmax;height:60vmax;border-radius:50%;background:radial-gradient(circle at 50% 50%,#ec4899 0%,transparent 60%);top:30%;left:30%;filter:blur(140px);opacity:.35;animation:float 28s ease-in-out infinite -5s}
@keyframes float{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(5vw,-5vh) scale(1.1)}66%{transform:translate(-5vw,5vh) scale(.95)}}
.grid-bg{position:fixed;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:50px 50px;mask-image:radial-gradient(ellipse at center,black 40%,transparent 75%);pointer-events:none;z-index:0}
.glass{background:rgba(255,255,255,.04);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border:1px solid rgba(255,255,255,.08)}
.glass-strong{background:rgba(255,255,255,.06);backdrop-filter:blur(30px) saturate(200%);-webkit-backdrop-filter:blur(30px) saturate(200%);border:1px solid rgba(255,255,255,.12)}
.glow-btn{position:relative;overflow:hidden;transition:all .3s ease}
.glow-btn::before{content:"";position:absolute;inset:-2px;background:linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4,#7c3aed);background-size:300% 300%;z-index:-1;border-radius:inherit;opacity:0;transition:opacity .3s ease;animation:gradient-shift 3s ease infinite}
.glow-btn:hover::before{opacity:1}
.glow-btn:hover{transform:translateY(-2px);box-shadow:0 20px 40px -10px rgba(124,58,237,.5)}
@keyframes gradient-shift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.shine{position:relative;overflow:hidden}
.shine::after{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.08),transparent);transition:left .8s ease}
.shine:hover::after{left:100%}
.text-gradient{background:linear-gradient(135deg,#a78bfa 0%,#f0abfc 50%,#67e8f9 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
@keyframes float-y{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.float-y{animation:float-y 4s ease-in-out infinite}
@keyframes pulse-glow{0%,100%{box-shadow:0 0 20px rgba(124,58,237,.4),0 0 40px rgba(236,72,153,.2)}50%{box-shadow:0 0 40px rgba(124,58,237,.7),0 0 80px rgba(236,72,153,.4)}}
.pulse-glow{animation:pulse-glow 3s ease-in-out infinite}
@keyframes fade-in-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.fade-in-up{animation:fade-in-up .6s ease forwards}
header{position:relative;z-index:10}
main{position:relative;z-index:10;max-width:1200px;margin:0 auto;padding:32px 24px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:24px 0 40px}
.stat{border-radius:16px;padding:20px}
.stat-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:12px}
.card{border-radius:24px;padding:24px;margin-bottom:16px;transition:transform .2s}
.card:hover{transform:scale(1.01)}
.badge{font-size:10px;font-weight:900;padding:4px 10px;border-radius:999px;display:inline-block;margin-left:6px}
.toggle{width:48px;height:24px;border-radius:999px;position:relative;cursor:pointer;transition:background .3s}
.toggle-thumb{position:absolute;top:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3);transition:all .3s cubic-bezier(.68,-.55,.27,1.55)}
.action-btn{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;transition:.2s;font-size:16px}
.action-btn:hover{background:rgba(255,255,255,.1)}
::-webkit-scrollbar{width:10px}::-webkit-scrollbar-track{background:rgba(255,255,255,.02)}::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#7c3aed,#ec4899);border-radius:10px}
</style>
</head>
<body>
<div class="aurora"><div class="aurora-3"></div></div>
<div class="grid-bg"></div>
${content}
<script>${script}</script>
</body>
</html>`;
}

app.listen(PORT, () => console.log('Nebula Panels running on ' + PORT));
