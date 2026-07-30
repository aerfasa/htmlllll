const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

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

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>آپلود HTML</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .box {
      background: white;
      padding: 30px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,.1);
      width: 90%;
      max-width: 500px;
      text-align: center;
    }
    input, button {
      width: 100%;
      padding: 12px;
      margin-top: 12px;
      box-sizing: border-box;
    }
    button {
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
    }
    a {
      display: block;
      margin-top: 15px;
      word-break: break-all;
      color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="box">
    <h2>فایل HTML خود را آپلود کنید</h2>
    <form id="form">
      <input type="file" id="file" accept=".html" required />
      <button type="submit">آپلود</button>
    </form>
    <div id="result"></div>
  </div>

  <script>
    const form = document.getElementById('form');
    const file = document.getElementById('file');
    const result = document.getElementById('result');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!file.files[0]) return;

      const formData = new FormData();
      formData.append('html', file.files[0]);

      const res = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        result.innerHTML = '<p>لینک سایت شما:</p><a href="' + data.url + '" target="_blank">' + data.url + '</a>';
      } else {
        result.innerHTML = '<p style="color:red">' + data.error + '</p>';
      }
    });
  </script>
</body>
</html>
  `);
});

app.post('/upload', upload.single('html'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'فایلی انتخاب نشده' });
  }

  const id = path.parse(req.file.filename).name;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${proto}://${req.get('host')}`;

  res.json({
    url: `${baseUrl}/view/${id}`
  });
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
