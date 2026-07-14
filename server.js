const fs = require('fs')
const path = require('path')
const express = require('express')

const app = express()
const PORT = process.env.PORT || 3000
const SECRET = process.env.ACTIVATE_SECRET || 'GM_BAND10_2026_PRIVATE_KEY'
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const CARD_FILE = path.join(DATA_DIR, 'cards.json')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

function readCards() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(CARD_FILE)) {
    fs.writeFileSync(CARD_FILE, JSON.stringify({ cards: [] }, null, 2))
  }
  return JSON.parse(fs.readFileSync(CARD_FILE, 'utf8'))
}

function writeCards(data) {
  fs.writeFileSync(CARD_FILE, JSON.stringify(data, null, 2))
}

function makeActivationCode(deviceId) {
  const text = deviceId + SECRET
  let sum = 173
  for (let i = 0; i < text.length; i++) {
    sum = (sum * 31 + text.charCodeAt(i)) % 1000000
  }
  return String(sum).padStart(6, '0')
}

function normalize(text) {
  return String(text || '').trim().toUpperCase()
}

function getAdminToken() {
  return process.env.ADMIN_TOKEN || 'admin-dev-token'
}

function makeCard() {
  const raw = Array.from(require('crypto').randomBytes(6))
    .map(n => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return 'GM-' + raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8, 12)
}

app.get('/', (req, res) => {
  res.redirect('/activate')
})

app.get('/activate', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>黄金矿工激活</title>
  <style>
    body{margin:0;background:#080a16;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .wrap{max-width:460px;margin:0 auto;padding:24px}
    .card{background:#141b31;border-radius:22px;padding:22px;box-shadow:0 12px 30px rgba(0,0,0,.35)}
    h1{margin:0 0 8px;color:#ffd56a;font-size:28px}
    p{color:#cbd5ff;line-height:1.6}
    label{display:block;margin:16px 0 8px;color:#ffd56a}
    input{width:100%;box-sizing:border-box;border:0;border-radius:16px;padding:15px;font-size:18px;background:#242d50;color:#fff}
    button{width:100%;margin-top:20px;border:0;border-radius:18px;padding:16px;font-size:20px;background:#ffb33e;color:#1a1322;font-weight:700}
    .result{margin-top:18px;padding:16px;border-radius:16px;background:#0f1527;text-align:center;font-size:22px;color:#ffd56a}
    .tip{font-size:14px;color:#9aa6c8}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>黄金矿工激活</h1>
      <p>请输入你在爱发电购买后收到的卡密，再输入手环激活页显示的手环ID。系统会生成只能绑定该手环ID的二层密码。</p>
      <label>卡密</label>
      <input id="cardKey" placeholder="例如 GM-XXXX-XXXX-XXXX" />
      <label>手环ID</label>
      <input id="deviceId" placeholder="例如 GM-123456" />
      <button onclick="exchange()">生成二层密码</button>
      <div id="result" class="result" style="display:none"></div>
      <p class="tip">注意：卡密生成二层密码后会立即作废，不能再次换码。</p>
    </div>
  </div>
  <script>
    async function exchange(){
      const cardKey = document.getElementById('cardKey').value
      const deviceId = document.getElementById('deviceId').value
      const box = document.getElementById('result')
      box.style.display = 'block'
      box.textContent = '正在生成...'
      const res = await fetch('/api/exchange', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ cardKey, deviceId })
      })
      const data = await res.json()
      if(data.ok){
        box.innerHTML = '手环二层密码：<br><b style="font-size:34px">' + data.activationCode + '</b>'
      }else{
        box.textContent = data.message || '生成失败'
      }
    }
  </script>
</body>
</html>`)
})

app.get('/admin', (req, res) => {
  const token = req.query.token || ''
  if (token !== getAdminToken()) {
    return res.status(403).send('管理密码错误')
  }

  res.type('html').send(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>黄金矿工卡密后台</title>
  <style>
    body{margin:0;background:#080a16;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .wrap{max-width:760px;margin:0 auto;padding:24px}
    .card{background:#141b31;border-radius:22px;padding:22px;margin-bottom:18px}
    h1{margin:0 0 12px;color:#ffd56a}
    input,button,textarea{width:100%;box-sizing:border-box;border:0;border-radius:14px;padding:13px;font-size:16px}
    input,textarea{background:#242d50;color:#fff}
    button{margin-top:12px;background:#ffb33e;color:#1a1322;font-weight:700}
    textarea{height:180px;margin-top:12px;font-family:monospace}
    table{width:100%;border-collapse:collapse;font-size:14px}
    td,th{border-bottom:1px solid #2e385f;padding:8px;text-align:left}
    .ok{color:#68e6a6}.used{color:#ff8d82}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>黄金矿工卡密后台</h1>
      <input id="count" value="20" type="number" />
      <button onclick="createCards()">生成卡密</button>
      <textarea id="output" placeholder="生成的卡密会显示在这里，可以复制到爱发电自动发货"></textarea>
    </div>
    <div class="card">
      <button onclick="loadCards()">刷新卡密列表</button>
      <div id="list"></div>
    </div>
  </div>
  <script>
    const token = new URLSearchParams(location.search).get('token')
    async function createCards(){
      const count = Number(document.getElementById('count').value || 20)
      const res = await fetch('/api/admin/create-cards?token=' + encodeURIComponent(token), {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ count })
      })
      const data = await res.json()
      document.getElementById('output').value = data.cards ? data.cards.join('\\n') : (data.message || '生成失败')
      loadCards()
    }
    async function loadCards(){
      const res = await fetch('/api/cards?token=' + encodeURIComponent(token))
      const data = await res.json()
      if(!data.cards){ document.getElementById('list').textContent = '读取失败'; return }
      const rows = data.cards.slice().reverse().map(card =>
        '<tr><td>' + card.cardKey + '</td><td class="' + (card.used?'used':'ok') + '">' + (card.used?'已用':'未用') + '</td><td>' + (card.deviceId || '') + '</td></tr>'
      ).join('')
      document.getElementById('list').innerHTML = '<table><tr><th>卡密</th><th>状态</th><th>绑定ID</th></tr>' + rows + '</table>'
    }
    loadCards()
  </script>
</body>
</html>`)
})

app.post('/api/exchange', (req, res) => {
  const cardKey = normalize(req.body.cardKey)
  const deviceId = normalize(req.body.deviceId)

  if (!/^GM-\d{6}$/.test(deviceId)) {
    return res.json({ ok: false, message: '手环ID格式错误' })
  }

  if (!cardKey) {
    return res.json({ ok: false, message: '请输入卡密' })
  }

  const data = readCards()
  const card = data.cards.find(item => normalize(item.cardKey) === cardKey)

  if (!card) {
    return res.json({ ok: false, message: '卡密不存在' })
  }

  if (card.used) {
    return res.json({ ok: false, message: '卡密已使用，不能重复生成' })
  }

  const activationCode = makeActivationCode(deviceId)

  card.used = true
  card.deviceId = deviceId
  card.activationCode = activationCode
  card.usedAt = new Date().toISOString()

  writeCards(data)
  res.json({ ok: true, activationCode })
})

app.get('/api/cards', (req, res) => {
  const token = req.query.token || ''
  if (token !== getAdminToken()) {
    return res.status(403).json({ ok: false })
  }
  res.json(readCards())
})

app.post('/api/admin/create-cards', (req, res) => {
  const token = req.query.token || ''

  if (token !== getAdminToken()) {
    return res.status(403).json({ ok: false, message: '管理密码错误' })
  }

  const count = Math.min(Math.max(Number(req.body.count || 20), 1), 1000)
  const data = readCards()
  const cards = []

  for (let i = 0; i < count; i++) {
    let cardKey = makeCard()
    while (data.cards.some(card => card.cardKey === cardKey)) {
      cardKey = makeCard()
    }
    data.cards.push({ cardKey, used: false, createdAt: new Date().toISOString() })
    cards.push(cardKey)
  }

  writeCards(data)
  res.json({ ok: true, cards })
})

app.listen(PORT, () => {
  console.log('activation server listening on http://localhost:' + PORT)
})

