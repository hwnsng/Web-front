import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { teams, matchesPerTeam, standings, validResult, koreaDate } from './league.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR || path.join(root, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'league.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS admin (username TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS standing_adjustments (
    name TEXT PRIMARY KEY, total INTEGER NOT NULL, remaining INTEGER NOT NULL,
    win INTEGER NOT NULL, lose INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY, date TEXT NOT NULL, time TEXT NOT NULL, home TEXT NOT NULL, away TEXT NOT NULL,
    homeSets INTEGER, awaySets INTEGER, UNIQUE(date,time,home,away));
`);
if (!db.prepare('SELECT 1 FROM admin LIMIT 1').get()) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 10) throw new Error('최초 실행 시 ADMIN_PASSWORD를 10자 이상으로 설정하세요.');
  const salt = randomBytes(16).toString('hex');
  db.prepare('INSERT INTO admin VALUES (?,?,?)').run(process.env.ADMIN_USERNAME || 'admin', salt, scryptSync(password, salt, 64).toString('hex'));
}
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(req.method) && req.get('Origin') && req.get('Origin') !== `${req.protocol}://${req.get('host')}` && req.get('Origin') !== process.env.APP_ORIGIN) {
    return res.status(403).json({ error: '허용되지 않은 요청입니다.' });
  }
  next();
});
const tokenHash = value => createHash('sha256').update(value).digest('hex');
function session(req) {
  const token = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('session='))?.slice(8);
  return token ? db.prepare('SELECT token FROM sessions WHERE token=? AND expires>?').get(tokenHash(token), Date.now()) : null;
}
function adminOnly(req, res, next) {
  if (!session(req)) return res.status(401).json({ error: '관리자 로그인이 필요합니다.' });
  next();
}
const attempts = new Map();
app.post('/api/login', (req, res) => {
  const key = req.ip;
  const attempt = attempts.get(key);
  if (attempt && attempt.until > Date.now() && attempt.count >= 10) return res.status(429).json({ error: '잠시 후 다시 시도하세요 (15분).' });
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 256) return res.status(400).json({ error: '아이디와 비밀번호를 확인하세요.' });
  const user = db.prepare('SELECT * FROM admin WHERE username=?').get(username);
  const computed = scryptSync(password, user?.salt || 'invalid-user-salt', 64);
  if (!user || !timingSafeEqual(computed, Buffer.from(user.hash, 'hex'))) {
    attempts.set(key, { count: attempt?.until > Date.now() ? attempt.count + 1 : 1, until: attempt?.until > Date.now() ? attempt.until : Date.now() + 900000 });
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  attempts.delete(key);
  db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions VALUES (?,?)').run(tokenHash(token), Date.now() + 8 * 3600000);
  res.cookie('session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: 8 * 3600000 });
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => {
  const current = session(req);
  if (current) db.prepare('DELETE FROM sessions WHERE token=?').run(current.token);
  res.clearCookie('session').json({ ok: true });
});
app.get('/api/state', (req, res) => {
  const matches = db.prepare('SELECT * FROM matches ORDER BY date,time,id').all();
  const adjustments = db.prepare('SELECT * FROM standing_adjustments').all();
  res.json({ admin: !!session(req), today: koreaDate(), teams, matches, standings: standings(matches, adjustments) });
});
app.put('/api/standings', adminOnly, (req, res) => {
  const updates = req.body?.teams;
  const fields = ['total', 'remaining', 'win', 'lose'];
  if (!Array.isArray(updates) || updates.length < 1 || updates.length > teams.length ||
      new Set(updates.map(team => team?.name)).size !== updates.length ||
      updates.some(team => !team || !teams.includes(team.name) || !team.expected ||
        fields.some(field => !Number.isSafeInteger(team[field]) || team[field] < 0 || team[field] > 1000000))) {
    return res.status(400).json({ error: '팀별 경기 기록을 확인해주세요.' });
  }
  if (updates.some(team => team.win + team.lose > team.total)) {
    return res.status(400).json({ error: '승리와 패배의 합은 경기 수를 넘을 수 없습니다.' });
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const matches = db.prepare('SELECT * FROM matches').all();
    const current = standings(matches, db.prepare('SELECT * FROM standing_adjustments').all());
    const original = standings(matches);
    for (const update of updates) {
      const team = current.find(row => row.name === update.name);
      if ([...fields, 'point'].some(field => update.expected[field] !== team[field])) {
        db.exec('ROLLBACK');
        return res.status(409).json({ error: `${update.name} 팀의 기록이 편집 중 변경되었습니다. 취소 후 다시 수정해주세요.` });
      }
    }
    const save = db.prepare(`INSERT INTO standing_adjustments(name,total,remaining,win,lose) VALUES (?,?,?,?,?)
      ON CONFLICT(name) DO UPDATE SET total=excluded.total,remaining=excluded.remaining,win=excluded.win,lose=excluded.lose`);
    for (const update of updates) {
      const team = original.find(row => row.name === update.name);
      save.run(update.name, ...fields.map(field => update[field] - team[field]));
    }
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (error) { db.exec('ROLLBACK'); throw error; }
});
app.put('/api/standings/:name', adminOnly, (req, res) => {
  const name = req.params.name;
  if (!teams.includes(name)) return res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
  const fields = ['total', 'remaining', 'win', 'lose'];
  if (!req.body || fields.some(field => !Number.isSafeInteger(req.body[field]) || req.body[field] < 0 || req.body[field] > 1000000)) {
    return res.status(400).json({ error: '각 항목에 0 이상 1,000,000 이하의 정수를 입력하세요.' });
  }
  if (req.body.win + req.body.lose > req.body.total) {
    return res.status(400).json({ error: '승리와 패배의 합은 경기 수를 넘을 수 없습니다.' });
  }
  const matches = db.prepare('SELECT * FROM matches').all();
  const current = standings(matches, db.prepare('SELECT * FROM standing_adjustments').all()).find(team => team.name === name);
  if (req.body.expected && fields.some(field => req.body.expected[field] !== current[field])) {
    return res.status(409).json({ error: '편집 중 경기 기록이 변경되었습니다. 창을 닫고 다시 수정해주세요.' });
  }
  const original = standings(matches).find(team => team.name === name);
  db.prepare(`INSERT INTO standing_adjustments(name,total,remaining,win,lose) VALUES (?,?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET total=excluded.total,remaining=excluded.remaining,win=excluded.win,lose=excluded.lose`)
    .run(name, ...fields.map(field => req.body[field] - original[field]));
  res.json({ ok: true });
});
app.post('/api/matches', adminOnly, (req, res) => {
  const { date, time, home, away } = req.body;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date ||
      typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !teams.includes(home) || !teams.includes(away) || home === away) {
    return res.status(400).json({ error: '날짜, 시간, 서로 다른 두 팀을 확인하세요.' });
  }
  const conflict = db.prepare('SELECT id FROM matches WHERE date=? AND time=? AND (home IN (?,?) OR away IN (?,?))').get(date, time, home, away, home, away);
  if (conflict) return res.status(409).json({ error: '같은 시간에 해당 팀의 경기가 이미 있습니다.' });
  const result = db.prepare('INSERT INTO matches(date,time,home,away) VALUES (?,?,?,?)').run(date, time, home, away);
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});
app.patch('/api/matches/:id', adminOnly, (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id=?').get(req.params.id);
  if (!match) return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
  if (match.homeSets !== null) return res.status(409).json({ error: '결과가 입력된 경기의 일정은 수정할 수 없습니다.' });
  const { time, home, away } = req.body;
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !teams.includes(home) || !teams.includes(away) || home === away) {
    return res.status(400).json({ error: '시간과 서로 다른 두 팀을 확인하세요.' });
  }
  const conflict = db.prepare('SELECT id FROM matches WHERE id<>? AND date=? AND time=? AND (home IN (?,?) OR away IN (?,?))').get(match.id, match.date, time, home, away, home, away);
  if (conflict) return res.status(409).json({ error: '같은 시간에 해당 팀의 경기가 이미 있습니다.' });
  db.prepare('UPDATE matches SET time=?,home=?,away=? WHERE id=?').run(time, home, away, match.id);
  res.json({ ok: true });
});
app.put('/api/matches/:id/result', adminOnly, (req, res) => {
  const match = db.prepare('SELECT * FROM matches WHERE id=?').get(req.params.id);
  if (!match) return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
  if (match.date > koreaDate()) return res.status(400).json({ error: '미래 경기에는 결과를 입력할 수 없습니다.' });
  const { homeSets, awaySets } = req.body;
  if (!validResult(homeSets, awaySets)) return res.status(400).json({ error: '2:0, 2:1, 0:2, 1:2 중 하나를 입력하세요.' });
  if (match.homeSets === null) {
    const completedCount = db.prepare('SELECT COUNT(*) AS count FROM matches WHERE homeSets IS NOT NULL AND (home=? OR away=?)');
    for (const team of [match.home, match.away]) {
      if (completedCount.get(team, team).count >= matchesPerTeam) {
        return res.status(409).json({ error: `${team} 팀은 총 ${matchesPerTeam}경기를 모두 완료했습니다. 기존 결과만 수정할 수 있습니다.` });
      }
    }
  }
  const projected = standings(db.prepare('SELECT * FROM matches').all().map(row => row.id === match.id ? { ...row, homeSets, awaySets } : row), db.prepare('SELECT * FROM standing_adjustments').all());
  if (projected.some(team => [match.home, match.away].includes(team.name) && team.win + team.lose > team.total)) {
    return res.status(409).json({ error: '수동 보정된 승리·패배의 합이 경기 수를 초과합니다. 순위표 기록을 먼저 조정해주세요.' });
  }
  db.prepare('UPDATE matches SET homeSets=?,awaySets=? WHERE id=?').run(homeSets, awaySets, match.id);
  res.json({ ok: true });
});
app.delete('/api/matches/:id', adminOnly, (req, res) => {
  const result = db.prepare('DELETE FROM matches WHERE id=? AND homeSets IS NULL').run(req.params.id);
  if (!result.changes) return res.status(409).json({ error: '미완료 경기만 삭제할 수 있습니다.' });
  res.json({ ok: true });
});
app.use('/api', (_req, res) => res.status(404).json({ error: '없는 API입니다.' }));
if (existsSync(path.join(root, 'dist'))) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
}
app.use((error, _req, res, _next) => {
  console.error(error.message);
  res.status(error.status || 500).json({ error: '요청을 처리하지 못했습니다.' });
});
const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', error => {
  if (error) {
    console.error(error.code === 'EADDRINUSE'
      ? `포트 ${port}이 이미 사용 중입니다. 실행 중인 스포츠 클럽 서버(npm start 또는 npm run dev)를 종료한 뒤 다시 실행하세요.`
      : `서버 실행 실패: ${error.message}`);
    db.close();
    process.exitCode = 1;
    return;
  }
  console.log(`Sports club server ready: http://localhost:${port}`);
});
