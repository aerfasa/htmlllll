const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: (process.env.SESSION_SECRET || 'change-this-secret').trim(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: 'auto',
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + '.html')
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.toLowerCase().endsWith('.html')) {
      cb(null, true);
    } else {
      cb(new Error('فقط فایل HTML مجاز است'));
    }
  }
});

function layout(title, content, script = '') {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    :root{
      --bg:#05030f;
      --glass: rgba(255,255,255,.07);
      --glass-strong: rgba(255,255,255,.10);
      --line: rgba(255,255,255,.12);
      --text: #f8fafc;
      --muted: rgba(255,255,255,.62);
      --muted2: rgba(255,255,255,.42);
      --accent1: #7c3aed;
      --accent2: #d946ef;
      --accent3: #22d3ee;
      --accent4: #06b6d4;
      --success: #10b981;
      --danger: #ef4444;
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(124,58,237,.28), transparent 28%),
        radial-gradient(circle at top right, rgba(217,70,239,.22), transparent 26%),
        radial-gradient(circle at bottom right, rgba(34,211,238,.12), transparent 26%),
        linear-gradient(135deg, #04020b 0%, #070816 45%, #05030f 100%);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      overflow-x: hidden;
    }

    .aurora {
      position: fixed;
      inset: -20%;
      pointer-events: none;
      z-index: 0;
      filter: blur(70px);
      opacity: .75;
    }
    .aurora::before,
    .aurora::after {
      content: "";
      position: absolute;
      border-radius: 999px;
      mix-blend-mode: screen;
    }
    .aurora::before {
      width: 420px;
      height: 420px;
      left: 10%;
      top: 8%;
      background: radial-gradient(circle, rgba(124,58,237,.55), rgba(124,58,237,0) 70%);
      animation: float1 10s ease-in-out infinite;
    }
    .aurora::after {
      width: 520px;
      height: 520px;
      right: 8%;
      bottom: 6%;
      background: radial-gradient(circle, rgba(34,211,238,.42), rgba(34,211,238,0) 70%);
      animation: float2 12s ease-in-out infinite;
    }

    .grid-bg {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      opacity: .16;
      background-image:
        linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px);
      background-size: 56px 56px;
      mask-image: radial-gradient(circle at center, black 30%, transparent 88%);
    }

    .shell {
      position: relative;
      z-index: 2;
      width: min(1200px, 100%);
      margin: 0 auto;
      padding: 24px;
    }

    .glass {
      background: var(--glass);
      border: 1px solid var(--line);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      box-shadow: 0 20px 70px rgba(0,0,0,.35);
    }

    .glass-strong {
      background: var(--glass-strong);
      border: 1px solid rgba(255,255,255,.14);
      backdrop-filter: blur(22px);
      -webkit-backdrop-filter: blur(22px);
      box-shadow: 0 22px 80px rgba(0,0,0,.42);
    }

    .header {
      position: sticky;
      top: 18px;
      z-index: 30;
      border-radius: 24px;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 24px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .logo {
      width: 46px;
      height: 46px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, var(--accent1), var(--accent2), var(--accent3));
      box-shadow: 0 18px 35px rgba(124,58,237,.28);
      flex: 0 0 auto;
      font-size: 22px;
    }
    .brand h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: .2px;
    }
    .brand p {
      margin: 4px 0 0;
      color: var(--muted2);
      font-size: 12px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.08);
      color: rgba(255,255,255,.78);
      font-size: 13px;
      text-decoration: none;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #34d399;
      box-shadow: 0 0 0 6px rgba(52,211,153,.12);
    }

    .icon-btn,
    .btn {
      border: none;
      cursor: pointer;
      text-decoration: none;
      color: white;
      font-weight: 800;
      transition: .2s transform ease, .2s opacity ease, .2s box-shadow ease, .2s background ease;
    }

    .icon-btn {
      width: 46px;
      height: 46px;
      border-radius: 15px;
      display: grid;
      place-items: center;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.08);
    }
    .icon-btn:hover { transform: translateY(-1px); background: rgba(255,255,255,.12); }

    .btn {
      width: 100%;
      padding: 15px 18px;
      border-radius: 18px;
      background: linear-gradient(135deg, #7c3aed 0%, #d946ef 45%, #22d3ee 100%);
      box-shadow: 0 18px 35px rgba(124,58,237,.22);
      font-size: 16px;
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 22px 42px rgba(124,58,237,.28); }
    .btn:disabled { opacity: .65; cursor: not-allowed; transform: none; }

    .btn-ghost {
      padding: 12px 16px;
      border-radius: 16px;
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.08);
      color: white;
      font-weight: 700;
      cursor: pointer;
    }

    .text-gradient {
      background: linear-gradient(135deg, #fff 0%, #c4b5fd 20%, #22d3ee 70%, #f472b6 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .muted { color: var(--muted); }
    .muted2 { color: var(--muted2); }

    .page-title {
      margin: 0;
      font-size: clamp(30px, 5vw, 54px);
      line-height: 1.05;
      letter-spacing: -.7px;
      font-weight: 950;
    }

    .section {
      margin-bottom: 22px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin: 18px 0 22px;
    }
    .stat {
      padding: 18px;
      border-radius: 22px;
      position: relative;
      overflow: hidden;
    }
    .stat::before {
      content: "";
      position: absolute;
      inset: auto -30px -40px auto;
      width: 120px;
      height: 120px;
      border-radius: 999px;
      background: radial-gradient(circle, rgba(255,255,255,.10), transparent 70%);
      pointer-events: none;
    }
    .stat .icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      margin-bottom: 14px;
      background: linear-gradient(135deg, rgba(124,58,237,.95), rgba(217,70,239,.88));
    }
    .stat:nth-child(2) .icon { background: linear-gradient(135deg, rgba(34,211,238,.95), rgba(6,182,212,.88)); }
    .stat:nth-child(3) .icon { background: linear-gradient(135deg, rgba(251,146,60,.95), rgba(244,63,94,.9)); }
    .stat:nth-child(4) .icon { background: linear-gradient(135deg, rgba(16,185,129,.95), rgba(34,197,94,.9)); }

    .stat .num {
      font-size: 30px;
      font-weight: 950;
      line-height: 1;
      margin-bottom: 6px;
    }
    .stat .label {
      font-size: 12px;
      color: rgba(255,255,255,.52);
    }

    .hero {
      padding: 28px;
      border-radius: 30px;
      margin-bottom: 22px;
      position: relative;
      overflow: hidden;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: -30%;
      background: radial-gradient(circle at 30% 20%, rgba(124,58,237,.17), transparent 30%),
                  radial-gradient(circle at 80% 80%, rgba(34,211,238,.12), transparent 22%);
      pointer-events: none;
    }

    .hero-grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      gap: 18px;
      align-items: start;
    }

    .hero-card {
      padding: 22px;
      border-radius: 24px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.08);
    }

    .dropzone {
      border: 1.5px dashed rgba(255,255,255,.2);
      border-radius: 26px;
      padding: 28px 18px;
      text-align: center;
      cursor: pointer;
      background: rgba(255,255,255,.04);
      transition: .2s ease;
    }
    .dropzone:hover,
    .dropzone.dragover {
      transform: translateY(-1px);
      border-color: rgba(34,211,238,.8);
      background: rgba(34,211,238,.08);
    }

    .drop-ico {
      width: 78px;
      height: 78px;
      margin: 0 auto 14px;
      border-radius: 24px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(124,58,237,.95), rgba(217,70,239,.9), rgba(34,211,238,.82));
      box-shadow: 0 16px 34px rgba(124,58,237,.23);
      font-size: 34px;
      animation: bob 4s ease-in-out infinite;
    }

    .drop-title {
      font-size: 20px;
      font-weight: 900;
      margin: 0 0 8px;
    }
    .drop-sub {
      color: rgba(255,255,255,.5);
      font-size: 13px;
      margin-bottom: 6px;
    }

    .file-name {
      min-height: 24px;
      margin-top: 10px;
      font-weight: 800;
      color: #7dd3fc;
      word-break: break-all;
    }

    .input {
      width: 100%;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 18px;
      padding: 15px 16px;
      color: white;
      font-size: 15px;
      outline: none;
    }
    .input:focus {
      border-color: rgba(34,211,238,.75);
      box-shadow: 0 0 0 4px rgba(34,211,238,.14);
    }

    .stack { display: grid; gap: 12px; }

    .result {
      display: none;
      margin-top: 16px;
      border-radius: 20px;
      padding: 18px;
      border: 1px solid transparent;
    }
    .result.show { display: block; }
    .result.success {
      background: rgba(16,185,129,.12);
      border-color: rgba(16,185,129,.25);
    }
    .result.error {
      background: rgba(239,68,68,.12);
      border-color: rgba(239,68,68,.25);
    }
    .result a {
      color: #7dd3fc;
      word-break: break-all;
    }

    .copy-btn {
      margin-top: 10px;
      width: auto;
      padding: 11px 14px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.08);
      color: white;
      font-weight: 800;
      cursor: pointer;
    }

    .tips {
      margin: 0;
      padding: 0 18px 0 0;
      color: rgba(255,255,255,.72);
      line-height: 2;
    }

    .login-wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .login-card {
      width: min(460px, 100%);
      border-radius: 30px;
      padding: 28px;
    }

    .login-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 18px;
    }

    .error {
      margin-bottom: 14px;
      padding: 12px 14px;
      border-radius: 16px;
      background: rgba(239,68,68,.14);
      border: 1px solid rgba(239,68,68,.28);
      color: #fecaca;
    }

    .hint {
      margin-top: 14px;
      font-size: 13px;
      color: rgba(255,255,255,.45);
      line-height: 1.8;
    }

    .fade-in-up {
      animation: fadeUp .6s ease both;
    }
    .shine {
      position: relative;
      overflow: hidden;
    }
    .shine::after {
      content: "";
      position: absolute;
      inset: -30% -60%;
      background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,.08) 50%, transparent 60%);
      transform: translateX(-45%) rotate(8deg);
      transition: .6s ease;
      pointer-events: none;
    }
    .shine:hover::after {
      transform: translateX(35%) rotate(8deg);
    }

    .float-y { animation: floatY 5s ease-in-out infinite; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes float1 {
      0%,100% { transform: translate(0,0) scale(1); }
      50% { transform: translate(18px, 18px) scale(1.04); }
    }
    @keyframes float2 {
      0%,100% { transform: translate(0,0) scale(1); }
      50% { transform: translate(-18px, -10px) scale(1.05); }
    }
    @keyframes floatY {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes bob {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }

    @media (max-width: 980px) {
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .hero-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .shell { padding: 14px; }
      .header { top: 10px; padding: 14px; border-radius: 20px; }
      .stats { grid-template-columns: 1fr; }
      .hero { padding: 18px; border-radius: 24px; }
      .page-title { font-size: 30px; }
      .icon-btn { width: 44px; height: 44px; }
    }
  </style>
</head>
<body>
  <div class="aurora"></div>
  <div class="grid-bg"></div>
  <main class="shell">
    ${content}
  </main>
  <script>
    ${script}
  </script>
</body>
</html>`;
}

function loginPage(error = '') {
  return layout(
    'ورود',
    `
      <div class="login-wrap">
        <div class="glass-strong login-card fade-in-up shine">
          <div class="login-top">
            <div class="logo">🔐</div>
            <div>
              <h1 style="margin:0;font-size:18px;font-weight:900;">ورود امن</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,.44);font-size:12px;">فقط کاربران مجاز</p>
            </div>
          </div>

          <h2 class="page-title" style="font-size:34px;margin-bottom:10px;">خوش آمدی ✨</h2>
          <p class="muted" style="margin:0 0 20px;line-height:1.9;">
            رمز را وارد کن تا وارد داشبورد آپلود بشی.
          </p>

          ${error ? `<div class="error">${error}</div>` : ''}

          <form method="POST" action="/login" class="stack">
            <div>
              <label style="display:block;margin-bottom:8px;color:rgba(255,255,255,.8);font-size:13px;">رمز عبور</label>
              <input class="input" type="password" name="password" placeholder="رمز را بنویس" autocomplete="current-password" required />
            </div>
            <button class="btn" type="submit">ورود به پنل</button>
          </form>

          <div class="hint">
            رمز داخل کد ذخیره نشده و از <b>Railway Variables</b> خوانده می‌شود.
          </div>
        </div>
      </div>
    `
  );
}

function uploadPage() {
  const totalFiles = fs.existsSync(UPLOAD_DIR)
    ? fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.html')).length
    : 0;

  return layout(
    'داشبورد',
    `
      <header class="header glass fade-in-up">
        <div class="brand">
          <div class="logo">⚡</div>
          <div>
            <h1>Nebula Host</h1>
            <p>پنل آپلود HTML با طراحی شیشه‌ای</p>
          </div>
        </div>

        <div class="header-actions">
          <div class="pill"><span class="dot"></span> آنلاین</div>
          <a class="pill" href="/logout">خروج</a>
        </div>
      </header>

      <section class="section fade-in-up">
        <h2 class="page-title">
          خوش آمدی به <span class="text-gradient">داشبورد</span> ✨
        </h2>
        <p class="muted" style="margin:12px 0 0;font-size:17px;line-height:1.9;">
          فایل HTML خودت را آپلود کن و در چند ثانیه لینک اختصاصی بگیر.
        </p>
      </section>

      <section class="stats fade-in-up">
        <div class="stat glass shine">
          <div class="icon">📄</div>
          <div class="num">${totalFiles}</div>
          <div class="label">فایل‌های ذخیره‌شده</div>
        </div>

        <div class="stat glass shine">
          <div class="icon">🚀</div>
          <div class="num">1</div>
          <div class="label">پنل فعال</div>
        </div>

        <div class="stat glass shine">
          <div class="icon">🔗</div>
          <div class="num">${totalFiles}</div>
          <div class="label">لینک‌های ساخته‌شده</div>
        </div>

        <div class="stat glass shine">
          <div class="icon">🛡️</div>
          <div class="num">100%</div>
          <div class="label">ورود امن</div>
        </div>
      </section>

      <section class="hero glass-strong fade-in-up">
        <div class="hero-grid">
          <div class="hero-card">
            <h3 style="margin:0 0 10px;font-size:24px;font-weight:900;">آپلود فایل جدید</h3>
            <p class="muted" style="margin:0 0 18px;line-height:1.9;">
              فایل HTML را انتخاب کن، آپلودش کن، و لینک سایت را بگیر.
            </p>

            <form id="uploadForm" class="stack">
              <div class="dropzone" id="dropzone">
                <div class="drop-ico">☁️</div>
                <div class="drop-title">فایل HTML را اینجا بکش یا کلیک کن</div>
                <div class="drop-sub">فقط فایل با پسوند <b>.html</b> قبول می‌شود</div>
                <div class="file-name" id="fileName"></div>
                <input type="file" id="fileInput" accept=".html" hidden />
              </div>
              <button class="btn" id="uploadBtn" type="submit">آپلود و ساخت لینک</button>
            </form>

            <div class="result" id="result"></div>
          </div>

          <aside class="hero-card">
            <h3 style="margin:0 0 14px;font-size:22px;font-weight:900;">راهنمای سریع</h3>
            <ul class="tips">
              <li>فایل را با پسوند <b>.html</b> ذخیره کن.</li>
              <li>روی باکس آپلود کلیک کن یا فایل را بکش داخلش.</li>
              <li>بعد از آپلود، لینک را کپی کن و بازش کن.</li>
              <li>اگر خواستی بعداً طراحی را حتی شبیه‌تر هم می‌کنم.</li>
            </ul>

            <div style="margin-top:18px;padding:16px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);">
              <div style="font-weight:900;margin-bottom:8px;">نکته</div>
              <div class="muted" style="line-height:1.9;">
                این طراحی کاملاً با HTML و CSS خالص ساخته شده و روی Railway راحت اجرا می‌شود.
              </div>
            </div>
          </aside>
        </div>
      </section>
    `,
    `
      const dropzone = document.getElementById('dropzone');
      const fileInput = document.getElementById('fileInput');
      const fileName = document.getElementById('fileName');
      const form = document.getElementById('uploadForm');
      const result = document.getElementById('result');
      const uploadBtn = document.getElementById('uploadBtn');

      dropzone.addEventListener('click', function () {
        fileInput.click();
      });

      fileInput.addEventListener('change', function () {
        if (fileInput.files[0]) {
          fileName.textContent = 'فایل انتخاب شده: ' + fileInput.files[0].name;
        }
      });

      ['dragenter', 'dragover'].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function (e) {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function (e) {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', function (e) {
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
          fileName.textContent = 'فایل انتخاب شده: ' + file.name;
        }
      });

      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!fileInput.files[0]) return;

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'در حال آپلود...';

        const formData = new FormData();
        formData.append('htmlFile', fileInput.files[0]);

        try {
          const response = await fetch('/upload', {
            method: 'POST',
            body: formData
          });

          const data = await response.json();

          if (response.ok) {
            result.className = 'result show success';
            result.innerHTML =
              '<div style="display:grid;gap:10px;">' +
                '<div style="font-weight:900;">✅ فایل با موفقیت آپلود شد</div>' +
                '<a href="' + data.url + '" target="_blank">' + data.url + '</a>' +
                '<button class="copy-btn" id="copyBtn" type="button">کپی لینک</button>' +
              '</div>';

            document.getElementById('copyBtn').addEventListener('click', async function () {
              await navigator.clipboard.writeText(data.url);
              alert('لینک کپی شد');
            });
          } else {
            result.className = 'result show error';
            result.innerHTML = '<b>خطا:</b> ' + (data.error || 'خطای نامشخص');
          }
        } catch (err) {
          result.className = 'result show error';
          result.innerHTML = '<b>خطا:</b> مشکل در آپلود';
        }

        uploadBtn.disabled = false;
        uploadBtn.textContent = 'آپلود و ساخت لینک';
      });
    `
  );
}

function requireAuth(req, res, next) {
  if (req.session.auth) return next();
  return res.redirect('/login');
}

function requireApiAuth(req, res, next) {
  if (req.session.auth) return next();
  return res.status(401).json({ error: 'ابتدا وارد شوید' });
}

app.get('/login', (req, res) => {
  if (req.session.auth) return res.redirect('/');
  res.send(loginPage());
});

app.post('/login', (req, res) => {
  const password = (req.body.password || '').trim();
  const expected = (process.env.APP_PASSWORD || '').trim();

  if (!expected) {
    return res.status(500).send(loginPage('متغیر APP_PASSWORD در Railway تنظیم نشده'));
  }

  if (password === expected) {
    req.session.auth = true;
    return res.redirect('/');
  }

  return res.status(401).send(loginPage('رمز اشتباه است'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', requireAuth, (req, res) => {
  res.send(uploadPage());
});

app.post('/upload', requireApiAuth, upload.single('htmlFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'فایلی انتخاب نشده' });
  }

  const id = path.parse(req.file.filename).name;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const url = `${proto}://${req.get('host')}/view/${id}`;

  res.json({ url });
});

app.get('/view/:id', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.id + '.html');

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('فایل پیدا نشد');
  }

  res.sendFile(filePath);
});

app.use((err, req, res, next) => {
  if (req.path === '/upload') {
    return res.status(400).json({ error: err.message || 'خطا رخ داد' });
  }

  if (req.path === '/login') {
    return res.status(400).send(loginPage(err.message || 'خطا رخ داد'));
  }

  return res.status(500).send('خطای داخلی سرور');
});

app.listen(PORT, () => {
  console.log('Server running on ' + PORT);
});
