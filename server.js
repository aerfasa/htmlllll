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
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
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
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background:
        radial-gradient(circle at top left, rgba(99,102,241,.35), transparent 30%),
        radial-gradient(circle at top right, rgba(236,72,153,.25), transparent 30%),
        linear-gradient(135deg, #0f172a, #111827 50%, #0b1220);
      color: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      overflow-x: hidden;
    }
    .wrap {
      width: 100%;
      max-width: 980px;
      position: relative;
    }
    .blob {
      position: absolute;
      filter: blur(50px);
      opacity: .55;
      z-index: 0;
      pointer-events: none;
    }
    .b1 { top: -80px; left: -40px; width: 180px; height: 180px; background: #8b5cf6; }
    .b2 { bottom: -60px; right: 0; width: 220px; height: 220px; background: #06b6d4; }

    .card {
      position: relative;
      z-index: 1;
      background: rgba(15,23,42,.72);
      border: 1px solid rgba(255,255,255,.12);
      backdrop-filter: blur(18px);
      border-radius: 28px;
      box-shadow: 0 20px 70px rgba(0,0,0,.45);
      padding: 30px;
    }
    .login-card {
      max-width: 470px;
      margin: auto;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 800;
      letter-spacing: .5px;
    }
    .brand-badge {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #8b5cf6, #06b6d4);
      box-shadow: 0 10px 25px rgba(139,92,246,.3);
      flex: 0 0 auto;
    }
    .logout {
      text-decoration: none;
      color: #fff;
      background: rgba(255,255,255,.08);
      padding: 10px 16px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,.1);
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(28px, 4vw, 42px);
    }
    .subtitle {
      margin: 0 0 24px;
      color: #cbd5e1;
      line-height: 1.8;
    }
    .error {
      background: rgba(239,68,68,.15);
      border: 1px solid rgba(239,68,68,.35);
      color: #fecaca;
      padding: 12px 14px;
      border-radius: 14px;
      margin-bottom: 16px;
    }
    .field-label {
      display: block;
      margin: 0 0 8px;
      color: #e2e8f0;
      font-size: 14px;
    }
    .input {
      width: 100%;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.1);
      color: #fff;
      border-radius: 18px;
      padding: 15px 16px;
      outline: none;
      font-size: 15px;
    }
    .input::placeholder { color: #94a3b8; }
    .input:focus {
      border-color: rgba(56,189,248,.8);
      box-shadow: 0 0 0 4px rgba(56,189,248,.15);
    }
    .btn {
      width: 100%;
      border: none;
      cursor: pointer;
      border-radius: 18px;
      padding: 15px 18px;
      font-weight: 700;
      color: #fff;
      background: linear-gradient(135deg, #7c3aed, #06b6d4);
      box-shadow: 0 14px 30px rgba(6,182,212,.25);
      transition: .2s transform ease, .2s opacity ease;
      font-size: 16px;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn:disabled { opacity: .6; cursor: not-allowed; }
    .login-note {
      margin-top: 16px;
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.7;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.1fr .9fr;
      gap: 24px;
      align-items: start;
    }
    @media (max-width: 800px) {
      .hero { grid-template-columns: 1fr; }
      .card { padding: 22px; }
    }
    .panel {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 22px;
      padding: 18px;
    }
    .dropzone {
      border: 1.5px dashed rgba(255,255,255,.22);
      border-radius: 24px;
      padding: 26px;
      text-align: center;
      background: rgba(255,255,255,.04);
      transition: .2s ease;
      cursor: pointer;
    }
    .dropzone.dragover {
      border-color: #22d3ee;
      background: rgba(34,211,238,.09);
      transform: scale(1.01);
    }
    .drop-ico { font-size: 54px; }
    .file-name {
      margin-top: 10px;
      color: #7dd3fc;
      font-weight: 700;
      word-break: break-all;
      min-height: 24px;
    }
    .result {
      margin-top: 18px;
      padding: 18px;
      border-radius: 18px;
      background: rgba(16,185,129,.12);
      border: 1px solid rgba(16,185,129,.25);
      display: none;
    }
    .result.show { display: block; }
    .result a {
      color: #7dd3fc;
      word-break: break-all;
    }
    .small {
      color: #94a3b8;
      font-size: 13px;
      margin-top: 10px;
    }
    .copy {
      margin-top: 10px;
      padding: 11px 14px;
      border: none;
      border-radius: 14px;
      background: rgba(255,255,255,.08);
      color: #fff;
      cursor: pointer;
    }
    .stack {
      display: grid;
      gap: 12px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 18px;
    }
    .info {
      padding: 14px;
      border-radius: 18px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.08);
    }
    .info b {
      display: block;
      margin-bottom: 6px;
      color: #fff;
      font-size: 20px;
    }
    .muted {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.8;
    }
    a { color: inherit; }
  </style>
</head>
<body>
  ${content}
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
    <div class="wrap">
      <div class="blob b1"></div>
      <div class="blob b2"></div>

      <div class="card login-card">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div class="brand-badge">🔐</div>
          <div>
            <div style="font-weight:800;font-size:18px;">ورود امن</div>
            <div class="small">فقط کاربران مجاز</div>
          </div>
        </div>

        <h1>سلام 👋</h1>
        <p class="subtitle">رمز را وارد کن تا وارد پنل آپلود بشی.</p>

        ${error ? `<div class="error">${error}</div>` : ''}

        <form method="POST" action="/login" class="stack">
          <div>
            <label class="field-label">رمز عبور</label>
            <input class="input" type="password" name="password" placeholder="رمز را وارد کن" autocomplete="current-password" required />
          </div>
          <button class="btn" type="submit">ورود به پنل</button>
        </form>

        <div class="login-note">
          رمز داخل کد نیست و از متغیر محیطی خوانده می‌شود.
        </div>
      </div>
    </div>`
  );
}

function uploadPage() {
  return layout(
    'آپلود HTML',
    `
    <div class="wrap">
      <div class="blob b1"></div>
      <div class="blob b2"></div>

      <div class="card">
        <div class="topbar">
          <div class="brand">
            <div class="brand-badge">⚡</div>
            <div>
              <div style="font-size:18px;">HTML Host</div>
              <div class="small">آپلود فایل و ساخت لینک</div>
            </div>
          </div>
          <a class="logout" href="/logout">خروج</a>
        </div>

        <div class="hero">
          <div>
            <h1>فایل HTML را آپلود کن</h1>
            <p class="subtitle">فایل را انتخاب کن، ما برایش لینک سایت می‌سازیم.</p>

            <form id="uploadForm" class="stack">
              <div class="dropzone" id="dropzone">
                <div class="drop-ico">📄⬆️</div>
                <div style="font-weight:800;font-size:20px;margin-top:8px;">فایل HTML خود را اینجا بگذار</div>
                <div class="small">یا کلیک کن و فایل را انتخاب کن</div>
                <div class="file-name" id="fileName"></div>
                <input type="file" id="fileInput" accept=".html" hidden />
              </div>
              <button class="btn" id="uploadBtn" type="submit">آپلود و ساخت لینک</button>
            </form>

            <div class="result" id="result"></div>
          </div>

          <div class="panel">
            <h3 style="margin-top:0;">راهنمای سریع</h3>
            <div class="info-grid">
              <div class="info"><b>1</b><span class="muted">فایل HTML را انتخاب کن</span></div>
              <div class="info"><b>2</b><span class="muted">روی آپلود بزن</span></div>
              <div class="info"><b>3</b><span class="muted">لینک سایت را بگیر</span></div>
            </div>
            <p class="muted" style="margin-top:16px;">
              فقط فایل‌های با پسوند <b>.html</b> قبول می‌شوند.
            </p>
          </div>
        </div>
      </div>
    </div>
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
            result.className = 'result show';
            result.style.background = 'rgba(16,185,129,.12)';
            result.style.borderColor = 'rgba(16,185,129,.25)';
            result.innerHTML =
              '<div class="stack">' +
                '<div>✅ فایل با موفقیت آپلود شد</div>' +
                '<a href="' + data.url + '" target="_blank">' + data.url + '</a>' +
                '<button class="copy" id="copyBtn" type="button">کپی لینک</button>' +
              '</div>';

            document.getElementById('copyBtn').addEventListener('click', async function () {
              await navigator.clipboard.writeText(data.url);
              alert('لینک کپی شد');
            });
          } else {
            result.className = 'result show';
            result.style.background = 'rgba(239,68,68,.12)';
            result.style.borderColor = 'rgba(239,68,68,.25)';
            result.innerHTML = '<b>خطا:</b> ' + (data.error || 'خطای نامشخص');
          }
        } catch (err) {
          result.className = 'result show';
          result.style.background = 'rgba(239,68,68,.12)';
          result.style.borderColor = 'rgba(239,68,68,.25)';
          result.innerHTML = '<b>خطا:</b> مشکل در آپلود';
        }

        uploadBtn.disabled = false;
        uploadBtn.textContent = 'آپلود و ساخت لینک';
      });
    `
  );
}

const requirePageAuth = (req, res, next) => {
  if (req.session.auth) return next();
  res.redirect('/login');
};

const requireApiAuth = (req, res, next) => {
  if (req.session.auth) return next();
  res.status(401).json({ error: 'ابتدا وارد شوید' });
};

app.get('/login', (req, res) => {
  if (req.session.auth) return res.redirect('/');
  res.send(loginPage());
});

app.post('/login', (req, res) => {
  const password = req.body.password || '';
  if (password === process.env.APP_PASSWORD) {
    req.session.auth = true;
    return res.redirect('/');
  }
  res.status(401).send(loginPage('رمز اشتباه است'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', requirePageAuth, (req, res) => {
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
  res.status(400).json({ error: err.message || 'خطا رخ داد' });
});

app.listen(PORT, () => {
  console.log('Server running on ' + PORT);
});
