import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { teams } from './league.mjs';

export const sample2026ExcludedDates = [
  '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', // Exam preparation week.
  '2026-09-21', '2026-09-22', '2026-09-23', // Written exams.
  '2026-09-24', '2026-09-25', '2026-10-05', '2026-10-09', // Holidays.
];

export function sample2026Matches() {
  // Fixed random seed makes the requested sample identical across local and deployed databases.
  let seed = 20260824;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const shuffle = items => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  };
  // Five complete rounds and four games: every class plays five or six games.
  const rotation = shuffle(teams);
  const pairs = [];
  for (let round = 0; round < 7; round++) {
    const fixtures = [];
    for (let index = 0; index < 6; index++) fixtures.push([rotation[index], rotation[11 - index]]);
    pairs.push(...shuffle(fixtures));
    rotation.splice(1, 0, rotation.pop());
  }
  const dates = [];
  const day = new Date('2026-08-24T00:00:00Z');
  // One game on each school weekday, excluding holidays, exams and preparation week.
  while (day.toISOString().slice(0, 10) <= '2026-10-26') {
    const date = day.toISOString().slice(0, 10);
    if (day.getUTCDay() > 0 && day.getUTCDay() < 6 && !sample2026ExcludedDates.includes(date)) dates.push(date);
    day.setUTCDate(day.getUTCDate() + 1);
  }
  const fixtures = dates.map((date, index) => {
    const [home, away] = random() < 0.5 ? pairs[index] : [...pairs[index]].reverse();
    const homeWins = random() < 0.5;
    const losingSets = random() < 0.5 ? 0 : 1;
    return { date, time: '12:50', home, away, homeSets: homeWins ? 2 : losingSets, awaySets: homeWins ? losingSets : 2 };
  });
  // Estimated results adjusted to the requested within-grade strength order.
  const scores = ['2:0', '1:2', '0:2', '1:2', '2:0', '1:2', '2:0', '2:0', '0:2', '2:0', '0:2', '0:2',
    '2:0', '1:2', '0:2', '2:0', '2:0', '0:2', '0:2', '0:2', '0:2', '0:2', '0:2', '2:0', '0:2',
    '2:0', '0:2', '2:1', '2:1', '2:0', '0:2', '1:2', '2:0', '0:2'];
  return fixtures.map((fixture, index) => {
    const [homeSets, awaySets] = scores[index].split(':').map(Number);
    return { ...fixture, homeSets, awaySets };
  });
}

export function rebalance2026Sample(db, backupDirectory) {
  const migration = '2026-sample-fewer-point-ties-v6';
  if (db.prepare('SELECT 1 FROM league_migrations WHERE name=?').get(migration)) return { updated: false };
  const fixtures = sample2026Matches();
  const find = db.prepare('SELECT id,homeSets,awaySets FROM matches WHERE date=? AND time=? AND home=? AND away=?');
  const changed = db.prepare("SELECT COUNT(*) AS count FROM matches WHERE date BETWEEN '2026-08-24' AND '2026-10-26'").get().count !== fixtures.length || fixtures.some(fixture => {
    const saved = find.get(fixture.date, fixture.time, fixture.home, fixture.away);
    return !saved || saved.homeSets !== fixture.homeSets || saved.awaySets !== fixture.awaySets;
  }) || ['standing_adjustments', 'standing_history'].some(table => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count > 0);
  if (changed) {
    mkdirSync(backupDirectory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(backupDirectory, `before-2026-schooldays-${Date.now()}.sqlite`));
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT 1 FROM league_migrations WHERE name=?').get(migration)) {
      db.exec("DELETE FROM matches WHERE date BETWEEN '2026-08-24' AND '2026-10-26'");
      const insert = db.prepare('INSERT INTO matches(date,time,home,away,homeSets,awaySets) VALUES (?,?,?,?,?,?)');
      for (const fixture of fixtures) {
        insert.run(fixture.date, fixture.time, fixture.home, fixture.away, fixture.homeSets, fixture.awaySets);
      }
      db.exec('DELETE FROM standing_adjustments; DELETE FROM standing_history;');
      db.prepare('INSERT INTO league_migrations(name,applied_at) VALUES (?,?)').run(migration, new Date().toISOString());
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { updated: true, matches: fixtures.length };
}

export function seed2026Sample(db, backupDirectory) {
  const migration = '2026-sample-37-games-through-2026-10-26-v1';
  if (db.prepare('SELECT 1 FROM league_migrations WHERE name=?').get(migration)) return { seeded: false };
  const previous = ['matches', 'standing_adjustments', 'standing_history'].some(table => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count > 0);
  if (previous) {
    mkdirSync(backupDirectory, { recursive: true });
    db.prepare('VACUUM INTO ?').run(path.join(backupDirectory, `before-2026-sample-${Date.now()}.sqlite`));
  }
  const fixtures = sample2026Matches();
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT 1 FROM league_migrations WHERE name=?').get(migration)) {
      db.exec('DELETE FROM matches; DELETE FROM standing_adjustments; DELETE FROM standing_history;');
      const insert = db.prepare('INSERT INTO matches(date,time,home,away,homeSets,awaySets) VALUES (?,?,?,?,?,?)');
      for (const fixture of fixtures) insert.run(fixture.date, fixture.time, fixture.home, fixture.away, fixture.homeSets, fixture.awaySets);
      db.prepare('INSERT INTO league_migrations(name,applied_at) VALUES (?,?)').run(migration, new Date().toISOString());
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return { seeded: true, matches: fixtures.length };
}
