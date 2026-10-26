import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { estimated2025, initializeSeasons } from './seasons.mjs';

test('2025 estimate has 12 completed teams and consistent round-robin totals and requested ranks', () => {
  const rows = estimated2025();
  assert.equal(rows.length, 12);
  assert.deepEqual(rows.slice(0, 2).map(team => team.name), ['3-3', '2-1']);
  assert.equal(rows[4].name, '2-2');
  assert.ok(rows[0].point > rows[1].point);
  assert.ok(rows.every(team => ['승', '패'].includes(team.streak.result) && team.streak.count > 0 && team.streak.count <= (team.streak.result === '승' ? team.win : team.lose)));
  assert.ok(rows.find(team => team.name === '2-3').rank > 5);
  assert.deepEqual(rows.slice(-2).map(team => team.name), ['2-4', '1-4']);
  assert.ok(rows.every(team => team.total === 11 && team.remaining === 0 && team.win + team.lose === 11 && team.point === team.winScore * 3));
  assert.equal(rows.reduce((sum, team) => sum + team.win, 0), 66);
  assert.equal(rows.reduce((sum, team) => sum + team.lose, 0), 66);
  assert.equal(rows.reduce((sum, team) => sum + team.winScore, 0), rows.reduce((sum, team) => sum + team.loseScore, 0));
  assert.ok(rows.every(team => team.winScore >= team.win * 2 && team.winScore <= team.win * 2 + team.lose));
});

test('season migration clears old fixtures and corrections once, preserves admin, and backs up previous data', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sports-season-'));
  const db = new DatabaseSync(':memory:');
  let backup;
  try {
    db.exec(`CREATE TABLE matches(id INTEGER PRIMARY KEY);
      CREATE TABLE standing_adjustments(name TEXT);
      CREATE TABLE standing_history(name TEXT);
      CREATE TABLE admin(username TEXT);
      INSERT INTO matches VALUES(1);
      INSERT INTO standing_adjustments VALUES('1-1');
      INSERT INTO standing_history VALUES('1-1');
      INSERT INTO admin VALUES('admin');`);
    const result = initializeSeasons(db, directory);
    assert.equal(result.reset, true);
    assert.ok(result.backup);
    backup = new DatabaseSync(result.backup, { readOnly: true });
    assert.equal(backup.prepare('SELECT COUNT(*) AS count FROM matches').get().count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM matches').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM standing_adjustments').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM standing_history').get().count, 0);
    assert.equal(db.prepare('SELECT username FROM admin').get().username, 'admin');
    assert.equal(JSON.parse(db.prepare('SELECT standings FROM season_archives WHERE year=2025').get().standings)[0].name, '3-3');
    db.exec('INSERT INTO matches VALUES(2)');
    db.exec(`DELETE FROM league_migrations WHERE name='2025-estimated-streaks-and-points-v2';
      UPDATE season_archives SET standings='[]' WHERE year=2025;
      INSERT INTO standing_adjustments VALUES('2-1');
      INSERT INTO standing_history VALUES('2-1');`);
    assert.equal(initializeSeasons(db, directory).reset, false);
    assert.equal(db.prepare('SELECT id FROM matches').get().id, 2);
    assert.equal(db.prepare('SELECT name FROM standing_adjustments').get().name, '2-1');
    assert.equal(db.prepare('SELECT name FROM standing_history').get().name, '2-1');
    const updated = JSON.parse(db.prepare('SELECT standings FROM season_archives WHERE year=2025').get().standings);
    assert.deepEqual(updated.slice(0, 2).map(team => team.point), [63, 60]);
    assert.deepEqual(updated[0].streak, { result: '승', count: 5 });
  } finally {
    backup?.close(); db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
