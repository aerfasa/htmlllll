const express = require('express');
const multer = require('multer');
const { nanoid } = require('nanoid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ایجاد پوشه uploads اگر وجود نداره
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// تنظیمات multer برای آپلود فایل
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueId = nanoid(10);
    cb(null, uniqueId + '.html');
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/html' || file.originalname.endsWith('.html')) {
      cb(null, true);
    } else {
      cb(new Error('فقط فایل HTML مجاز است!'));
    }
  }
});

app.use(express.static('public'));

// صفحه اصلی
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>آپلود فایل HTML</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 500px;
          width: 100%;
        }
        h1 {
          color: #333;
          margin-bottom: 10px;
          text-align: center;
        }
        p {
          color: #666;
          margin-bottom: 30px;
          text-align: center;
        }
        .upload-area {
          border: 3px dashed #667eea;
          border-radius: 15px;
          padding: 40px;
          text-align: center;
          transition: all 0.3s;
          cursor: pointer;
          background: #f8f9ff;
        }
        .upload-area:hover {
          border-color: #764ba2;
          background: #f0f1ff;
        }
        .upload-area.dragover {
          background: #e8e9ff;
          border-color: #764ba2;
        }
        input[type="file"] {
          display: none;
        }
        .upload-icon {
          font-size: 50px;
          margin-bottom: 15px;
        }
        button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 15px 40px;
          border-radius: 50px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 20px;
          width: 100%;
          font-weight: bold;
          transition: transform 0.2s;
        }
        button:hover {
          transform: translateY(-2px);
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .result {
          margin-top: 20px;
          padding: 20px;
          background: #e8f5e9;
          border-radius: 10px;
          display: none;
        }
        .result.show {
          display: block;
        }
        .link {
          color: #667eea;
          word-break: break-all;
          font-weight: bold;
        }
        .copy-btn {
          background: #4caf50;
          margin-top: 10px;
          padding: 10px 20px;
        }
        .file-name {
          margin-top: 15px;
          color: #667eea;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📤 آپلود فایل HTML</h1>
        <p>فایل HTML خود را آپلود کنید و لینک دریافت کنید</p>
        
        <form id="uploadForm" enctype="multipart/form-data">
          <div class="upload-area" id="uploadArea">
            <div class="upload-icon">📄</div>
            <p>فایل را اینجا بکشید یا کلیک کنید</p>
            <input type="file" id="fileInput" name="htmlFile" accept=".html" required>
            <div class="file-name" id="fileName"></div>
          </div>
          <button type="submit" id="submitBtn">آپلود و دریافت لینک 🚀</button>
        </form>

        <div class="result" id="result">
          <p>✅ فایل با موفقیت آپلود شد!</p>
          <p>لینک وبسایت شما:</p>
          <a href="" target="_blank" class="link" id="fileLink"></a>
          <button class="copy-btn" onclick="copyLink()">کپی لینک 📋</button>
        </div>
      </div>

      <script>
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const fileName = document.getElementById('fileName');
        const form = document.getElementById('uploadForm');
        const result = document.getElementById('result');
        const fileLink = document.getElementById('fileLink');
        const submitBtn = document.getElementById('submitBtn');

        uploadArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
          if (e.target.files.length > 0) {
            fileName.textContent = '📄 ' + e.target.files[0].name;
          }
        });

        uploadArea.addEventListener('dragover', (e) => {
          e.preventDefault();
          uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
          uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadArea.classList.remove('dragover');
          fileInput.files = e.dataTransfer.files;
          if (fileInput.files.length > 0) {
            fileName.textContent = '📄 ' + fileInput.files[0].name;
          }
        });

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = new FormData();
          formData.append('htmlFile', fileInput.files[0]);

          submitBtn.disabled = true;
          submitBtn.textContent = 'در حال آپلود...';

          try {
            const response = await fetch('/upload', {
              method: 'POST',
              body: formData
            });

            const data = await response.json();

            if (response.ok) {
              fileLink.href = data.url;
              fileLink.textContent = data.url;
              result.classList.add('show');
              submitBtn.textContent = 'آپلود موفقیت‌آمیز! ✅';
            } else {
              alert('خطا: ' + data.error);
              submitBtn.disabled = false;
              submitBtn.textContent = 'آپلود و دریافت لینک 🚀';
            }
          } catch (error) {
            alert('خطا در آپلود فایل!');
            submitBtn.disabled = false;
            submitBtn.textContent = 'آپلود و دریافت لینک 🚀';
          }
        });

        function copyLink() {
          navigator.clipboard.writeText(fileLink.href);
          alert('لینک کپی شد! ✅');
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/upload', upload.single('htmlFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'فایلی آپلود نشده!' });
  }

  const fileUrl = `${req.protocol}://${req.get('host')}/view/${req.file.filename.replace('.html', '')}`;
  
  res.json({ 
    success: true, 
    url: fileUrl,
    filename: req.file.filename
  });
});

app.get('/view/:id', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.id + '.html');
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('<h1>فایل پیدا نشد! 404</h1>');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
