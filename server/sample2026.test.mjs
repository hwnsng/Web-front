import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sample2026Matches, sample2026ExcludedDates, seed2026Sample, rebalance2026Sample } from './sample2026.mjs';
import { standings, validResult } from './league.mjs';

test('2026 sample excludes holidays, exams and exam preparation week with balanced team appearances', () => {
  const fixtures = sample2026Matches();
  assert.equal(fixtures.length, 34);
  assert.equal(fixtures[0].date, '2026-08-24');
  assert.equal(fixtures.at(-1).date, '2026-10-26');
  for (const match of fixtures) {
    assert.ok([1, 2, 3, 4, 5].includes(new Date(`${match.date}T00:00:00Z`).getUTCDay()));
    assert.ok(!sample2026ExcludedDates.includes(match.date));
    assert.ok(validResult(match.homeSets, match.awaySets));
  }
  const eligible = [];
  for (const date = new Date('2026-08-24T00:00:00Z'); date <= new Date('2026-10-26T00:00:00Z'); date.setUTCDate(date.getUTCDate() + 1)) {
    const day = date.toISOString().slice(0, 10);
    if (date.getUTCDay() > 0 && date.getUTCDay() < 6 && !sample2026ExcludedDates.includes(day)) eligible.push(day);
  }
  assert.deepEqual(fixtures.map(match => match.date), eligible);
  assert.equal(new Set(fixtures.map(match => [match.home, match.away].sort().join('/'))).size, 34);
  const rows = standings(fixtures.map((match, index) => ({ ...match, id: index + 1 })));
  assert.equal(rows.filter(team => team.total === 5).length, 4);
  assert.equal(rows.filter(team => team.total === 6).length, 8);
  assert.equal(rows.reduce((sum, team) => sum + team.win, 0), 34);
  assert.equal(rows.reduce((sum, team) => sum + team.lose, 0), 34);
  assert.ok(rows.every(team => team.win + team.lose === team.total && team.remaining === 11 - team.total && team.point === team.winScore * 3 && team.streak.count > 0));
  assert.equal(rows[0].name, '3-2');
  assert.equal(rows.find(team => team.name === '3-2').point, 30);
  assert.equal(rows.find(team => team.name === '2-1').point, 27);
  assert.equal(rows.find(team => team.name === '3-1').rank, 3);
  assert.equal(rows.find(team => team.name === '1-2').rank, 5);
  assert.equal(rows.find(team => team.name === '3-3').rank, 7);
  assert.equal(new Set(rows.map(team => team.point)).size, 9);
  assert.ok(rows.every(team => rows.filter(other => other.point === team.point).length <= 2));
  for (const order of [['1-2', '1-4', '1-1', '1-3'], ['3-2', '3-1', '3-3', '3-4'], ['2-1', '2-3', '2-2', '2-4']]) {
    const positions = order.map(name => rows.find(team => team.name === name).rank);
    assert.ok(positions.slice(1).every((rank, index) => rank >= positions[index]));
  }
});

test('2026 sample is seeded once without changing the 2025 archive or replacing later results', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sports-schooldays-'));
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE league_migrations(name TEXT PRIMARY KEY,applied_at TEXT);
      CREATE TABLE matches(id INTEGER PRIMARY KEY,date TEXT,time TEXT,home TEXT,away TEXT,homeSets INTEGER,awaySets INTEGER);
      CREATE TABLE standing_adjustments(name TEXT); CREATE TABLE standing_history(name TEXT);
      CREATE TABLE season_archives(year INTEGER PRIMARY KEY,standings TEXT);
      INSERT INTO season_archives VALUES(2025,'keep-2025');`);
    assert.equal(seed2026Sample(db, directory).matches, 34);
    assert.equal(rebalance2026Sample(db, directory).updated, true);
    db.exec("INSERT INTO matches(date,time,home,away,homeSets,awaySets) VALUES('2026-10-27','12:50','1-1','1-2',2,0)");
    assert.equal(seed2026Sample(db, directory).seeded, false);
    assert.equal(rebalance2026Sample(db, directory).updated, false);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM matches').get().count, 35);
    assert.equal(db.prepare('SELECT standings FROM season_archives WHERE year=2025').get().standings, 'keep-2025');
    // Upgrade a previously seeded calendar that still contains an excluded exam-prep day.
    db.exec(`DELETE FROM league_migrations WHERE name='2026-sample-fewer-point-ties-v6';
      INSERT INTO matches(date,time,home,away,homeSets,awaySets) VALUES('2026-09-14','12:50','1-1','1-2',2,0)`);
    assert.equal(rebalance2026Sample(db, directory).updated, true);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM matches').get().count, 35);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM matches WHERE date='2026-09-14'").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM matches WHERE date='2026-10-27'").get().count, 1);
    assert.equal(db.prepare('SELECT standings FROM season_archives WHERE year=2025').get().standings, 'keep-2025');
  } finally { db.close(); await rm(directory, { recursive: true, force: true }); }
});
