import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { standings } from './league.mjs';

export const activeSeason = 2026;

// User-supplied partial records. The final table below is an estimate, not verified history.
export const source2025 = [
  { name: '1-1', wins: 3, losses: 0, goalsFor: 6, goalsAgainst: 1, forMoon: '3W' },
  { name: '1-2', wins: 2, losses: 2, goalsFor: 4, goalsAgainst: 5, forMoon: '1W' },
  { name: '1-3', wins: 0, losses: 4, goalsFor: 1, goalsAgainst: 8, forMoon: '4L' },
  { name: '1-4', wins: 0, losses: 4, goalsFor: 1, goalsAgainst: 8, forMoon: '4L' },
  { name: '2-1', wins: 4, losses: 0, goalsFor: 8, goalsAgainst: 1, forMoon: '4W' },
  { name: '2-2', wins: 2, losses: 1, goalsFor: 5, goalsAgainst: 2, forMoon: '1L' },
  { name: '2-3', wins: 1, losses: 3, goalsFor: 2, goalsAgainst: 7, forMoon: '1W' },
  { name: '2-4', wins: 3, losses: 1, goalsFor: 6, goalsAgainst: 3, forMoon: '1W' },
  { name: '3-1', wins: 0, losses: 4, goalsFor: 1, goalsAgainst: 8, forMoon: '4L' },
  { name: '3-2', wins: 2, losses: 2, goalsFor: 6, goalsAgainst: 4, forMoon: '1L' },
  { name: '3-3', wins: 4, losses: 0, goalsFor: 8, goalsAgainst: 1, forMoon: '4W' },
  { name: '3-4', wins: 2, losses: 2, goalsFor: 4, goalsAgainst: 4, forMoon: '1L' },
].map(team => ({ ...team, draws: 0 }));

export function estimated2025() {
  const order = ['3-3', '2-1', '1-1', '1-2', '2-2', '3-2', '3-4', '2-3', '3-1', '1-3', '2-4', '1-4'];
  const upsets = new Set(['3-3/1-1', '1-1/1-2', '1-2/3-2', '2-2/3-4']);
  const estimates = [];
  // Build an internally consistent 66-match estimate, without adding fictional fixtures to the schedule.
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
    const upset = upsets.has(`${order[i]}/${order[j]}`);
    estimates.push({ id: estimates.length + 1, date: '2025-01-01', time: '12:50', home: order[i], away: order[j], homeSets: upset ? 0 : 2, awaySets: upset ? 2 : 0 });
  }
  const oneSetLosses = [1, 0, 1, 2, 4, 1, 2, 2, 2, 1, 1, 1];
  for (const [index, name] of order.entries()) {
    const losses = estimates.filter(match => (match.home === name && match.homeSets === 0) || (match.away === name && match.awaySets === 0));
    losses.sort((a, b) => {
      const winnerIndex = match => order.indexOf(match.homeSets === 2 ? match.home : match.away);
      // Keep the reconstructed champion ahead of the runner-up on set difference.
      const priority = match => winnerIndex(match) === 0 ? 99 : winnerIndex(match);
      return priority(a) - priority(b);
    });
    for (const match of losses.slice(0, oneSetLosses[index])) {
      if (match.home === name) match.homeSets = 1;
      else match.awaySets = 1;
    }
  }
  const streaks = {
    '3-3': ['승', 5], '2-1': ['승', 3], '1-1': ['승', 2], '1-2': ['패', 1],
    '2-2': ['승', 2], '3-2': ['패', 1], '3-4': ['패', 2], '2-3': ['승', 1],
    '3-1': ['패', 1], '1-3': ['패', 3], '2-4': ['패', 4], '1-4': ['패', 11],
  };
  return standings(estimates).map(team => {
    const [result, count] = streaks[team.name];
    const wins = team.win - (result === '승' ? count : 0);
    const losses = team.lose - (result === '패' ? count : 0);
    const prefix = result === '승' ? [...Array(wins).fill('승'), ...Array(losses).fill('패')]
      : [...Array(losses).fill('패'), ...Array(wins).fill('승')];
    return { ...team, recent: [...prefix, ...Array(count).fill(result)].slice(-5), streak: { result, count } };
  });
}

function update2025Archive(db) {
  const migration = '2025-estimated-streaks-and-points-v2';
  if (db.prepare('SELECT 1 FROM league_migrations WHERE name=?').get(migration)) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE season_archives SET standings=?,estimated=1 WHERE year=2025').run(JSON.stringify(estimated2025()));
    db.prepare('INSERT OR IGNORE INTO league_migrations(name,applied_at) VALUES (?,?)').run(migration, new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function initializeSeasons(db, backupDirectory) {
  db.exec(`CREATE TABLE IF NOT EXISTS league_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS season_archives (year INTEGER PRIMARY KEY, estimated INTEGER NOT NULL, standings TEXT NOT NULL, source TEXT NOT NULL);`);
  const migration = '2026-clean-start-with-2025-archive-v1';
  if (db.prepare('SELECT 1 FROM league_migrations WHERE name=?').get(migration)) {
    update2025Archive(db);
    return { reset: false };
  }
  const previous = Object.fromEntries(['matches', 'standing_adjustments', 'standing_history'].map(table => [table, db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]));
  let backup = null;
  if (Object.values(previous).some(count => count > 0)) {
    mkdirSync(backupDirectory, { recursive: true });
    backup = path.join(backupDirectory, `before-season-reset-${Date.now()}.sqlite`);
    db.prepare('VACUUM INTO ?').run(backup);
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT 1 FROM league_migrations WHERE name=?').get(migration)) {
      db.prepare('INSERT OR IGNORE INTO season_archives(year,estimated,standings,source) VALUES (2025,1,?,?)')
        .run(JSON.stringify(estimated2025()), JSON.stringify(source2025));
      db.exec('DELETE FROM matches; DELETE FROM standing_adjustments; DELETE FROM standing_history;');
      db.prepare('INSERT INTO league_migrations(name,applied_at) VALUES (?,?)').run(migration, new Date().toISOString());
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  update2025Archive(db);
  return { reset: true, previous, backup };
}
