import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(process.env.DATA_DIR || path.join(root, 'data'), 'league.sqlite');
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 10) throw new Error('.env의 ADMIN_PASSWORD를 10자 이상의 새 비밀번호로 설정하세요.');
if (!existsSync(file)) throw new Error('DB가 없습니다. 서버를 먼저 실행하세요.');
const db = new DatabaseSync(file);
const salt = randomBytes(16).toString('hex');
db.exec('BEGIN IMMEDIATE');
try {
  const result = db.prepare('UPDATE admin SET salt=?,hash=? WHERE username=?')
    .run(salt, scryptSync(password, salt, 64).toString('hex'), process.env.ADMIN_USERNAME || 'admin');
  if (!result.changes) throw new Error('관리자 계정이 없습니다.');
  db.exec('DELETE FROM sessions; COMMIT');
  console.log('관리자 비밀번호를 변경하고 모든 세션을 해제했습니다.');
} catch (error) { db.exec('ROLLBACK'); throw error; }
finally { db.close(); }
