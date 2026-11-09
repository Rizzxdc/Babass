// Sistem login + role (user / vip / admin) untuk API bot. Butuh Express.
// Pasang SEBELUM route /api lain:  require('./auth')(app, { apiToken: TOKEN_LAMA })
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const RANK = { user: 1, vip: 2, admin: 3 };
const FILE = path.join(__dirname, 'users.json');
const SECRET_FILE = path.join(__dirname, '.auth_secret');
const TTL = 7 * 24 * 3600 * 1000; // token berlaku 7 hari

// Izin per endpoint = role MINIMAL. Yang tidak terdaftar = admin saja.
const RULES = [
  ['GET',  /^\/status$/,            'user'],
  ['GET',  /^\/logs$/,              'user'],
  ['GET',  /^\/sessions$/,          'vip'],
  ['POST', /^\/sessions$/,          'vip'],
  ['GET',  /^\/sessions\/[^/]+\/db$/, 'vip'],
  ['GET',  /^\/cases(\/[^/]+)?$/,   'vip'],
  ['GET',  /^\/auth\/me$/,          'user'],
];

const SECRET = process.env.AUTH_SECRET || (fs.existsSync(SECRET_FILE) ? fs.readFileSync(SECRET_FILE, 'utf8')
  : (() => { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 }); return s; })());
const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const save = u => fs.writeFileSync(FILE, JSON.stringify(u, null, 2), { mode: 0o600 });
const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
const verify = (pw, h) => { const [s, x] = h.split(':'); return crypto.timingSafeEqual(Buffer.from(x), Buffer.from(crypto.scryptSync(pw, s, 64).toString('hex'))); };
const sign = p => { const b = Buffer.from(JSON.stringify(p)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', SECRET).update(b).digest('base64url'); };
function unsign(t) {
  const [b, m] = String(t || '').split('.'); if (!b || !m) return null;
  const e = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
  if (m.length !== e.length || !crypto.timingSafeEqual(Buffer.from(m), Buffer.from(e))) return null;
  try { const p = JSON.parse(Buffer.from(b, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}

module.exports = function (app, { apiToken } = {}) {
  const express = require('express');
  let users = load();
  if (!Object.keys(users).length) {
    const name = process.env.ADMIN_USER || 'admin', pw = process.env.ADMIN_PASS || crypto.randomBytes(6).toString('hex');
    users[name] = { hash: hash(pw), role: 'admin', created: Date.now() }; save(users);
    console.log(`[auth] Admin pertama dibuat -> username: ${name}  password: ${pw}  (segera ganti!)`);
  }
  const fails = {}; // pembatas login: 5 gagal / 10 menit / IP

  app.use('/api', express.json());
  app.use('/api', (req, res, next) => {
    if (req.method === 'POST' && req.path === '/auth/login') return next();
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    let who = null;
    if (apiToken && bearer === apiToken) who = { username: '(token)', role: 'admin' };   // token lama = admin
    else { const p = unsign(bearer); users = load(); if (p && users[p.u]) who = { username: p.u, role: users[p.u].role }; }
    if (!who) return res.status(401).json({ ok: false, error: 'Belum login / sesi habis' });
    const rule = RULES.find(([m, re]) => m === req.method && re.test(req.path));
    const need = rule ? rule[2] : 'admin';
    if (RANK[who.role] < RANK[need]) return res.status(403).json({ ok: false, error: 'Role ' + who.role + ' tidak punya akses' });
    req.user = who; next();
  });

  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip, f = fails[ip] = (fails[ip] || []).filter(t => Date.now() - t < 600000);
    if (f.length >= 5) return res.status(429).json({ ok: false, error: 'Terlalu banyak percobaan, tunggu 10 menit' });
    const { username, password } = req.body || {};
    users = load(); const u = users[String(username || '').toLowerCase()];
    if (!u || !verify(String(password || ''), u.hash)) { f.push(Date.now()); return res.status(401).json({ ok: false, error: 'Username atau password salah' }); }
    const name = String(username).toLowerCase();
    res.json({ ok: true, token: sign({ u: name, exp: Date.now() + TTL }), role: u.role, username: name });
  });
  app.get('/api/auth/me', (req, res) => res.json({ ok: true, ...req.user }));

  // --- kelola user (admin saja, dijaga oleh aturan default di atas) ---
  const okName = n => /^[a-z0-9_]{3,20}$/.test(n);
  app.get('/api/auth/users', (req, res) => { users = load(); res.json({ ok: true, users: Object.entries(users).map(([username, v]) => ({ username, role: v.role, created: v.created })) }); });
  app.post('/api/auth/users', (req, res) => {
    const n = String(req.body.username || '').toLowerCase(), { password, role } = req.body; users = load();
    if (!okName(n)) return res.json({ ok: false, error: 'Username 3-20 karakter: huruf kecil, angka, _' });
    if (!password || password.length < 6) return res.json({ ok: false, error: 'Password minimal 6 karakter' });
    if (!RANK[role]) return res.json({ ok: false, error: 'Role harus user / vip / admin' });
    if (users[n]) return res.json({ ok: false, error: 'Username sudah ada' });
    users[n] = { hash: hash(password), role, created: Date.now() }; save(users); res.json({ ok: true });
  });
  app.put('/api/auth/users/:u', (req, res) => {
    users = load(); const x = users[req.params.u]; if (!x) return res.json({ ok: false, error: 'User tidak ada' });
    const { role, password } = req.body;
    if (role) {
      if (!RANK[role]) return res.json({ ok: false, error: 'Role tidak valid' });
      if (x.role === 'admin' && role !== 'admin' && Object.values(users).filter(v => v.role === 'admin').length < 2) return res.json({ ok: false, error: 'Tidak boleh menurunkan admin terakhir' });
      x.role = role;
    }
    if (password) { if (password.length < 6) return res.json({ ok: false, error: 'Password minimal 6 karakter' }); x.hash = hash(password); }
    save(users); res.json({ ok: true });
  });
  app.delete('/api/auth/users/:u', (req, res) => {
    users = load(); const x = users[req.params.u]; if (!x) return res.json({ ok: false, error: 'User tidak ada' });
    if (req.params.u === req.user.username) return res.json({ ok: false, error: 'Tidak bisa menghapus akun sendiri' });
    if (x.role === 'admin' && Object.values(users).filter(v => v.role === 'admin').length < 2) return res.json({ ok: false, error: 'Tidak boleh menghapus admin terakhir' });
    delete users[req.params.u]; save(users); res.json({ ok: true });
  });
};
