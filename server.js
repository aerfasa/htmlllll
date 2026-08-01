const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DB_FILE = path.join(__dirname, "db.json");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ panels: {}, bots: {} }, null, 2));

const readDB = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { return { panels: {}, bots: {} }; } };
const writeDB = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({ secret: process.env.SESSION_SECRET || "nebula-secret", resave: false, saveUninitialized: false, cookie: { secure: "auto", maxAge: 7 * 24 * 60 * 60 * 1000 } }));

const escapeHTML = (v="") => String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const makeId = () => crypto.randomBytes(12).toString("hex");
const badRequest = () => `<!doctype html><html><head><meta charset="utf-8"><title>Bad Request</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;font-family:Arial}h1{font-size:44px}p{color:#777}</style></head><body><div><h1>Bad Request</h1><p>درخواست نامعتبر است.</p></div></body></html>`;

// --- TELEGRAM BOT MANAGER ---
const activeBots = new Map();
const botStates = new Map();

async function checkSubscription(bot, userId, channels) {
  if (!channels || channels.length === 0) return { ok: true };
  let notJoined = [];
  for (let ch of channels) {
    try {
      let member = await bot.getChatMember(ch, userId);
      if (['left', 'kicked'].includes(member.status)) notJoined.push(ch);
    } catch (e) { notJoined.push(ch); }
  }
  return notJoined.length === 0 ? { ok: true } : { ok: false, channels: notJoined };
}

function startBot(botData, hostUrl) {
  if (activeBots.has(botData.token)) return;
  const bot = new TelegramBot(botData.token, { polling: true });
  activeBots.set(botData.token, bot);
  const db = readDB();
  if(!db.bots[botData.id].users) db.bots[botData.id].users = {};
  writeDB(db);

  bot.on("polling_error", err => console.error("Bot error:", err.message));

  bot.onText(/^\/start$/, async (msg) => {
    const db = readDB();
    const b = db.bots[botData.id];
    b.users[msg.from.id] = { id: msg.from.id, name: msg.from.first_name };
    writeDB(db);

    if (b.maintenance && String(msg.from.id) !== String(b.ownerId)) return bot.sendMessage(msg.chat.id, "⚠️ ربات در حال حاضر در دست تعمیر است.");
    
    const sub = await checkSubscription(bot, msg.from.id, b.forcedChannels);
    if (!sub.ok) {
      let btns = sub.channels.map(ch => [{ text: `عضویت در ${ch}`, url: `https://t.me/${ch.replace('@','')}` }]);
      btns.push([{ text: "✅ عضو شدم", callback_data: "check_sub" }]);
      return bot.sendMessage(msg.chat.id, "⛔️ برای استفاده از ربات، ابتدا در کانال‌های زیر عضو شوید:", { reply_markup: { inline_keyboard: btns } });
    }

    bot.sendMessage(msg.chat.id, "✨ به Nebula Panels خوش آمدید\n\nفایل HTML خود را ارسال کنید.", {
      reply_markup: { inline_keyboard: [[{ text: "📂 پنل‌های من", callback_data: "my_panels" }]] }
    });
  });

  bot.on("callback_query", async (query) => {
    const db = readDB();
    const b = db.bots[botData.id];
    if (query.data === "check_sub") {
      const sub = await checkSubscription(bot, query.from.id, b.forcedChannels);
      if (!sub.ok) return bot.answerCallbackQuery(query.id, { text: "هنوز عضو نشده‌اید!", show_alert: true });
      bot.answerCallbackQuery(query.id, { text: "عضویت تایید شد ✅" });
      return bot.sendMessage(query.message.chat.id, "✅ ممنون! حالا می‌توانید فایل HTML خود را بفرستید.");
    }
    // ... (بقیه کالبک‌های قبلی مثل my_panels, toggle, delete)
    if (query.data === "my_panels") {
      const panels = Object.values(db.panels).filter(p => p.ownerBotId === botData.id && p.ownerUserId === String(query.from.id));
      if (!panels.length) return bot.answerCallbackQuery(query.id, { text: "پنلی ندارید", show_alert: true });
      const kb = panels.slice(0,5).map(p => [{ text: p.name, url: `${hostUrl}/view/${p.id}` }, { text: p.status==='active'?'⏸':'▶️', callback_data: `tog_${p.id}` }, { text: '🗑', callback_data: `del_${p.id}` }]);
      bot.sendMessage(query.message.chat.id, "📂 پنل‌های شما:", { reply_markup: { inline_keyboard: kb } });
      bot.answerCallbackQuery(query.id);
    }
    if (query.data.startsWith("tog_")) { const p = db.panels[query.data.split('_')[1]]; if(p && p.ownerUserId==String(query.from.id)){ p.status = p.status==='active'?'paused':'active'; writeDB(db); bot.answerCallbackQuery(query.id, {text:'تغییر کرد'}); } }
    if (query.data.startsWith("del_")) { const p = db.panels[query.data.split('_')[1]]; if(p && p.ownerUserId==String(query.from.id)){ if(fs.existsSync(path.join(UPLOAD_DIR, p.file))) fs.unlinkSync(path.join(UPLOAD_DIR, p.file)); delete db.panels[p.id]; writeDB(db); bot.answerCallbackQuery(query.id, {text:'حذف شد'}); bot.deleteMessage(query.message.chat.id, query.message.message_id); } }
  });

  // --- OWNER COMMANDS ---
  bot.onText(/^\/maintenance$/, (msg) => {
    if (String(msg.from.id) !== String(botData.ownerId)) return;
    const db = readDB();
    db.bots[botData.id].maintenance = !db.bots[botData.id].maintenance;
    writeDB(db);
    bot.sendMessage(msg.chat.id, db.bots[botData.id].maintenance ? "🔴 حالت تعمیر روشن شد (فقط شما دسترسی دارید)" : "🟢 ربات برای همه روشن شد");
  });

  bot.onText(/^\/broadcast (.+)/, (msg, match) => {
    if (String(msg.from.id) !== String(botData.ownerId)) return;
    const db = readDB();
    const users = Object.keys(db.bots[botData.id].users || {});
    bot.sendMessage(msg.chat.id, `📢 در حال ارسال پیام به ${users.length} کاربر...`);
    users.forEach((uid, i) => { setTimeout(() => { bot.sendMessage(uid, match[1]).catch(()=>{}); }, i * 50); });
  });

  bot.onText(/^\/users$/, (msg) => {
    if (String(msg.from.id) !== String(botData.ownerId)) return;
    const db = readDB();
    const users = Object.values(db.bots[botData.id].users || {});
    let txt = `👥 لیست کاربران (${users.length} نفر):\n\n`;
    users.slice(0, 20).forEach(u => txt += `▫️ ${u.name} (ID: ${u.id})\n`);
    bot.sendMessage(msg.chat.id, txt);
  });

  bot.onText(/^\/addchannel (@\w+)$/, (msg, match) => {
    if (String(msg.from.id) !== String(botData.ownerId)) return;
    const db = readDB();
    if (!db.bots[botData.id].forcedChannels) db.bots[botData.id].forcedChannels = [];
    if (!db.bots[botData.id].forcedChannels.includes(match[1])) {
      db.bots[botData.id].forcedChannels.push(match[1]);
      writeDB(db);
      bot.sendMessage(msg.chat.id, `✅ کانال ${match[1]} اضافه شد.\n(مطمئن شوید ربات در آن ادمین است)`);
    }
  });

  bot.onText(/^\/rmchannel (@\w+)$/, (msg, match) => {
    if (String(msg.from.id) !== String(botData.ownerId)) return;
    const db = readDB();
    db.bots[botData.id].forcedChannels = (db.bots[botData.id].forcedChannels || []).filter(c => c !== match[1]);
    writeDB(db);
    bot.sendMessage(msg.chat.id, `❌ کانال ${match[1]} حذف شد.`);
  });

  // --- UPLOAD LOGIC ---
  bot.on("document", async (msg) => {
    const db = readDB();
    const b = db.bots[botData.id];
    if (b.maintenance && String(msg.from.id) !== String(b.ownerId)) return bot.sendMessage(msg.chat.id, "⚠️ ربات در حال تعمیر است.");
    
    const sub = await checkSubscription(bot, msg.from.id, b.forcedChannels);
    if (!sub.ok) return bot.sendMessage(msg.chat.id, "⛔️ لطفاً ابتدا در کانال‌ها عضو شوید و /start کنید.");

    const doc = msg.document;
    if (!doc.file_name.toLowerCase().endsWith(".html")) return bot.sendMessage(msg.chat.id, "❌ فقط HTML");

    try {
      const link = await bot.getFileLink(doc.file_id);
      const res = await axios.get(link, { responseType: "arraybuffer" });
      const temp = path.join(UPLOAD_DIR, `temp_${msg.from.id}.html`);
      fs.writeFileSync(temp, res.data);
      botStates.set(`${botData.id}:${msg.from.id}`, { step: "name", temp, userId: String(msg.from.id), originalName: doc.file_name });
      bot.sendMessage(msg.chat.id, "📄 نام پنل را وارد کنید:");
    } catch { bot.sendMessage(msg.chat.id, "❌ خطا در دانلود"); }
  });

  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const key = `${botData.id}:${msg.from.id}`;
    const state = botStates.get(key);
    if (!state) return;

    if (state.step === "name") {
      state.name = msg.text.trim();
      state.step = "time";
      bot.sendMessage(msg.chat.id, "⏳ چند ثانیه فعال باشد؟ (حداقل 60)");
    } else if (state.step === "time") {
      const seconds = Number(msg.text);
      if (!Number.isInteger(seconds) || seconds < 60) return bot.sendMessage(msg.chat.id, "⚠️ حداقل 60 ثانیه");
      
      const id = makeId();
      const finalPath = path.join(UPLOAD_DIR, id + ".html");
      fs.renameSync(state.temp, finalPath);
      
      const db = readDB();
      db.panels[id] = { id, name: state.name, file: id + ".html", created: new Date().toISOString(), expires: new Date(Date.now() + seconds * 1000).toISOString(), status: "active", views: 0, password: "", ownerBotId: botData.id, ownerUserId: state.userId };
      writeDB(db);
      botStates.delete(key);

      const url = `${hostUrl}/view/${id}`;
      bot.sendMessage(msg.chat.id, `✅ ساخته شد!\n🔗 ${url}`, { reply_markup: { inline_keyboard: [[{ text: "🌐 باز کردن", url }]] } });

      // Send Log to Owner
      if (botData.ownerId) {
        bot.sendMessage(botData.ownerId, `📥 <b>آپلود جدید!</b>\n\n👤 کاربر: ${msg.from.first_name}\n🆔 آیدی: <code>${msg.from.id}</code>\n📄 فایل: ${state.name}\n⏳ زمان: ${seconds} ثانیه\n🔗 لینک: ${url}`, { parse_mode: "HTML" });
      }
    }
  });
}

function stopBot(token) { const b = activeBots.get(token); if(b) { b.stopPolling(); activeBots.delete(token); } }
function startSavedBots(hostUrl) { const db = readDB(); Object.values(db.bots).forEach(b => { if(b.status==='active') startBot(b, hostUrl); }); }

// --- WEB ROUTES ---
app.get("/", (req, res) => res.status(400).send(badRequest()));
app.use((req, res, next) => { if(!req.path.startsWith('/manage') && !req.path.startsWith('/view') && !req.path.startsWith('/edit') && !req.path.startsWith('/api') && !req.path.startsWith('/upload') && !req.path.startsWith('/logout')) return res.status(400).send(badRequest()); next(); });

const requireAuth = (req, res, next) => req.session.auth ? next() : res.redirect("/manage");

app.get("/manage", (req, res) => {
  if (!req.session.auth) return res.send(layout("ورود", `<div class="login card"><div class="logo" style="margin:auto">🔐</div><h2 class="gradient">Nebula</h2>${req.query.error?'<div class="error">رمز اشتباه</div>':''}<form method="post" action="/manage" class="stack"><div style="position:relative"><input id="p" class="input" type="password" name="password" placeholder="رمز عبور" required><button type="button" onclick="p.type=p.type==='password'?'text':'password'" style="position:absolute;left:10px;top:10px;background:none;border:0;color:white">👁️</button></div><button class="btn">ورود</button></form></div>`));
  const db = readDB();
  const panels = Object.values(db.panels).sort((a,b)=>new Date(b.created)-new Date(a.created));
  const bots = Object.values(db.bots);
  const panelCards = panels.map(p => `<div class="card panel"><div class="panel-top"><h3>${escapeHTML(p.name)}</h3><span class="badge ${p.status!=='active'||Date.now()>new Date(p.expires).getTime()?'off':''}">${Date.now()>new Date(p.expires).getTime()?'منقضی':p.status==='active'?'فعال':'متوقف'}</span></div><div class="muted">بازدید: ${p.views||0} | باقی‌مانده: ${remaining(p.expires)}</div><div class="url">${req.protocol}://${req.get('host')}/view/${p.id}</div><div class="actions"><button class="btn gray" onclick="navigator.clipboard.writeText('${req.protocol}://${req.get('host')}/view/${p.id}')">📋</button><a class="btn gray" href="/edit/${p.id}">✏️</a><button class="btn gray" onclick="fetch('/api/panel/toggle/${p.id}',{method:'POST'}).then(()=>location.reload())">⏯</button><button class="btn red" onclick="if(confirm('حذف؟'))fetch('/api/panel/delete/${p.id}',{method:'POST'}).then(()=>location.reload())">🗑</button></div></div>`).join("");
  const botCards = bots.map(b => `<div class="card panel"><div class="panel-top"><h3>@${escapeHTML(b.username)}</h3><span class="badge ${b.maintenance?'off':''}">${b.maintenance?'در تعمیر':'فعال'}</span></div><div class="muted">کانال‌های اجباری: ${(b.forcedChannels||[]).join(', ') || 'ندارد'}</div><div class="actions"><button class="btn gray" onclick="fetch('/api/bot/toggle-maint/${b.id}',{method:'POST'}).then(()=>location.reload())">🔧 تعمیر</button><button class="btn red" onclick="if(confirm('حذف؟'))fetch('/api/bot/delete/${b.id}',{method:'POST'}).then(()=>location.reload())">🗑</button></div></div>`).join("");
  
  res.send(layout("داشبورد", `<header class="header"><div class="brand"><div class="logo">⚡</div><div><h1 class="gradient">Nebula Panels</h1></div></div><div class="actions"><button class="btn" onclick="document.getElementById('m1').classList.add('open')">✨ پنل جدید</button><button class="btn gray" onclick="document.getElementById('m2').classList.add('open')">🤖 ربات جدید</button><a class="btn gray" href="/logout">خروج</a></div></header><h2>داشبورد</h2><h3 class="gradient">پنل‌ها</h3><div class="grid">${panelCards||'<div class="card">پنلی نیست</div>'}</div><h3 class="gradient" style="margin-top:30px">ربات‌ها</h3><div class="grid">${botCards||'<div class="card">ربات نیست</div>'}</div>
  <div class="modal" id="m1"><div class="modal-box card"><h3>ساخت پنل</h3><form id="uf" class="stack" enctype="multipart/form-data"><input class="input" type="file" name="htmlFile" accept=".html" required><input class="input" name="name" placeholder="نام" required><select class="input" name="expiry"><option value="60">1 دقیقه</option><option value="3600">1 ساعت</option><option value="86400">1 روز</option><option value="2592000" selected>30 روز</option></select><button class="btn">آپلود</button></form></div></div>
  <div class="modal" id="m2"><div class="modal-box card"><h3>ساخت ربات</h3><form id="bf" class="stack"><input class="input" name="token" placeholder="توکن ربات" required><input class="input" name="ownerId" placeholder="آیدی عددی مالک" required><input class="input" name="channels" placeholder="کانال‌های اجباری (با کاما جدا کنید: @ch1,@ch2)"><label style="color:white"><input type="checkbox" name="isPublic"> عمومی باشد</label><button class="btn">ساخت ربات</button></form></div></div>`, `
  document.querySelectorAll('.modal').forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.remove('open')});
  document.getElementById('uf').onsubmit=async e=>{e.preventDefault();const r=await fetch('/upload',{method:'POST',body:new FormData(e.target)});if(r.ok)location.reload();else alert((await r.json()).error)};
  document.getElementById('bf').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const r=await fetch('/api/bot/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:f.get('token'),ownerId:f.get('ownerId'),isPublic:f.get('isPublic')==='on',channels:f.get('channels')})});if(r.ok)location.reload();else alert((await r.json()).error)};
  `));
});
app.post("/manage", (req, res) => { if(String(req.body.password||"").trim() === String(process.env.APP_PASSWORD||"").trim()) { req.session.auth=true; return res.redirect("/manage"); } res.redirect("/manage?error=1"); });
app.get("/logout", (req, res) => { req.session.destroy(()=>res.redirect("/manage")); });

// --- UPLOAD & PANEL API ---
const upload = multer({ storage: multer.diskStorage({ destination: (r,f,cb)=>cb(null,UPLOAD_DIR), filename: (r,f,cb)=>cb(null, r.panelId+'.html') }), limits:{fileSize:10*1024*1024} });
app.post("/upload", requireAuth, (r,s,n)=>{ r.panelId=r.body.customSlug||makeId(); n(); }, upload.single("htmlFile"), (req, res) => { if(!req.file) return res.status(400).json({error:"فایل نیست"}); const db=readDB(); db.panels[req.panelId]={id:req.panelId, name:req.body.name, file:req.panelId+'.html', created:new Date().toISOString(), expires:new Date(Date.now()+Number(req.body.expiry)*1000).toISOString(), status:"active", views:0, password:"", ownerType:"web"}; writeDB(db); res.json({success:true}); });
app.post("/api/panel/toggle/:id", requireAuth, (req, res) => { const db=readDB(); if(db.panels[req.params.id]) { db.panels[req.params.id].status = db.panels[req.params.id].status==='active'?'paused':'active'; writeDB(db); } res.json({success:true}); });
app.post("/api/panel/delete/:id", requireAuth, (req, res) => { const db=readDB(); const p=db.panels[req.params.id]; if(p){ if(fs.existsSync(path.join(UPLOAD_DIR,p.file))) fs.unlinkSync(path.join(UPLOAD_DIR,p.file)); delete db.panels[req.params.id]; writeDB(db); } res.json({success:true}); });

// --- BOT API ---
app.post("/api/bot/create", requireAuth, async (req, res) => {
  try {
    const info = (await axios.get(`https://api.telegram.org/bot${req.body.token}/getMe`)).data.result;
    const db = readDB(); const id = makeId();
    const channels = req.body.channels ? req.body.channels.split(',').map(c=>c.trim()).filter(c=>c.startsWith('@')) : [];
    db.bots[id] = { id, username:info.username, token:req.body.token, ownerId:req.body.ownerId, public:req.body.isPublic, forcedChannels:channels, maintenance:false, users:{}, status:"active" };
    writeDB(db); startBot(db.bots[id], `${req.protocol}://${req.get('host')}`); res.json({success:true});
  } catch { res.status(400).json({error:"توکن نامعتبر"}); }
});
app.post("/api/bot/toggle-maint/:id", requireAuth, (req, res) => { const db=readDB(); if(db.bots[req.params.id]) { db.bots[req.params.id].maintenance = !db.bots[req.params.id].maintenance; writeDB(db); } res.json({success:true}); });
app.post("/api/bot/delete/:id", requireAuth, (req, res) => { const db=readDB(); const b=db.bots[req.params.id]; if(b){ stopBot(b.token); delete db.bots[req.params.id]; writeDB(db); } res.json({success:true}); });

// --- VIEW & EDIT ---
app.get("/view/:id", (req, res) => { const db=readDB(); const p=db.panels[req.params.id]; if(!p) return res.status(404).send(badRequest()); if(p.status!=='active') return res.status(403).send(badRequest()); if(Date.now()>new Date(p.expires).getTime()) return res.status(410).send(badRequest()); if(p.password && req.cookies['p_'+p.id]!==p.password) return res.send(layout("ورود", `<div class="login card"><h2>${escapeHTML(p.name)}</h2><form method="post" action="/view/${p.id}" class="stack"><input class="input" type="password" name="password" required><button class="btn">ورود</button></form></div>`)); p.views=(p.views||0)+1; writeDB(db); res.sendFile(path.join(UPLOAD_DIR, p.file)); });
app.post("/view/:id", (req, res) => { const db=readDB(); const p=db.panels[req.params.id]; if(p && p.password===req.body.password) { res.cookie('p_'+p.id, p.password, {maxAge:30*60*1000}); return res.redirect('/view/'+p.id); } res.redirect('/view/'+p.id+'?error=1'); });
app.get("/edit/:id", requireAuth, (req, res) => { const p=readDB().panels[req.params.id]; if(!p) return res.status(404).send(badRequest()); res.send(layout("ویرایش", `<header class="header"><a class="btn gray" href="/manage">بازگشت</a></header><form method="post" action="/edit/${p.id}" class="stack"><textarea name="code" class="input">${escapeHTML(fs.readFileSync(path.join(UPLOAD_DIR,p.file),'utf8'))}</textarea><button class="btn">ذخیره</button></form>`)); });
app.post("/edit/:id", requireAuth, (req, res) => { const p=readDB().panels[req.params.id]; if(p) fs.writeFileSync(path.join(UPLOAD_DIR,p.file), req.body.code); res.redirect("/manage"); });

// --- UI HELPERS ---
const remaining = (exp) => { const ms=new Date(exp)-Date.now(); if(ms<=0) return "پایان"; const s=Math.floor(ms/1000); if(s<3600) return Math.floor(s/60)+" دقیقه"; if(s<86400) return Math.floor(s/3600)+" ساعت"; return Math.floor(s/86400)+" روز"; };
function layout(title, content, script="") { return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;900&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}:root{--bg:#05030f;--card:rgba(255,255,255,.07);--line:rgba(255,255,255,.12);--text:#fff;--muted:#9ca3af;--purple:#7c3aed;--pink:#ec4899}body{margin:0;min-height:100vh;color:var(--text);font-family:Vazirmatn,Arial;background:radial-gradient(circle at top right,rgba(124,58,237,.35),transparent 30%),var(--bg)}body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.15;background-image:linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px);background-size:50px 50px}.container{position:relative;z-index:1;width:min(1120px,calc(100% - 30px));margin:auto;padding:25px 0 60px}.card{background:var(--card);border:1px solid var(--line);backdrop-filter:blur(20px);border-radius:24px;padding:24px}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;flex-wrap:wrap;gap:15px}.logo{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,var(--purple),var(--pink));font-size:23px}.brand{display:flex;align-items:center;gap:12px}h1,h2,h3{margin:0}.muted{color:var(--muted);font-size:13px}.gradient{background:linear-gradient(135deg,#c4b5fd,#f0abfc,#67e8f9);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.btn{border:0;border-radius:14px;padding:12px 16px;color:#fff;font-family:inherit;font-weight:700;cursor:pointer;text-decoration:none;background:linear-gradient(90deg,var(--purple),var(--pink))}.btn.gray{background:rgba(255,255,255,.08);border:1px solid var(--line)}.btn.red{background:#ef4444}.input,textarea{width:100%;color:#fff;background:rgba(255,255,255,.07);border:1px solid var(--line);border-radius:14px;padding:14px;font-family:inherit;outline:0}.stack{display:grid;gap:13px}.login{width:min(430px,100%);margin:110px auto 0;text-align:center}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:15px}.panel{display:flex;flex-direction:column;gap:14px}.panel-top{display:flex;justify-content:space-between;align-items:center}.badge{font-size:11px;border-radius:20px;padding:5px 9px;background:rgba(16,185,129,.16);color:#6ee7b7}.badge.off{background:rgba(239,68,68,.16);color:#fca5a5}.url{direction:ltr;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;background:rgba(0,0,0,.25);border:1px solid var(--line);border-radius:12px;padding:11px;font:12px monospace}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions .btn{font-size:12px;padding:9px 12px}.modal{position:fixed;inset:0;z-index:10;display:none;place-items:center;padding:15px;background:rgba(0,0,0,.8)}.modal.open{display:grid}.modal-box{width:min(500px,100%);max-height:90vh;overflow:auto}.error{padding:11px;border-radius:12px;color:#fca5a5;background:rgba(239,68,68,.14)}textarea{min-height:500px;direction:ltr;font-family:monospace}</style></head><body><div class="container">${content}</div><script>${script}</script></body></html>`; }

app.listen(PORT, () => { console.log("Running on " + PORT); setTimeout(() => startSavedBots(process.env.PUBLIC_URL || `http://localhost:${PORT}`), 1500); });
