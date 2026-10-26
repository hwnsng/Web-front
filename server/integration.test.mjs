import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { teams, standings, validResult } from './league.mjs';

test('best of three validation and shared ranks', () => {
  for (const score of [[2,0],[2,1],[0,2],[1,2]]) assert.equal(validResult(...score), true);
  for (const score of [[2,2],[1,1],[3,0],[-1,2],[2,0.5],['2',0]]) assert.equal(validResult(...score), false);
  assert.ok(standings([]).every(t => t.rank === 1 && t.total === 0 && t.remaining === 11));
});

test('equal points and games share ranks regardless of set difference and skip the next position', () => {
  const points = [30, 27, 24, 21, 18, 18, 15, 12, 9, 6, 3, 0];
  const rows = standings([], teams.map((name, index) => ({ name, total: 1, remaining: 10, win: 0, lose: 1, winSets: points[index] / 3, loseSets: index })));
  const first = rows.find(team => team.name === '2-1');
  const second = rows.find(team => team.name === '2-2');
  assert.notEqual(first.difference, second.difference);
  assert.equal(first.rank, 5);
  assert.equal(second.rank, 5);
  assert.equal(rows.find(team => team.name === '2-3').rank, 7);
});

test('fewer played games breaks a point tie before checking shared ranks', () => {
  const points = [30, 27, 24, 21, 18, 18, 15, 12, 9, 6, 3, 0];
  const rows = standings([], teams.map((name, index) => ({ name, total: index === 4 ? 2 : 1, remaining: 10,
    win: 0, lose: 1, winSets: points[index] / 3, loseSets: index })));
  assert.equal(rows.find(team => team.name === '2-2').rank, 5);
  assert.equal(rows.find(team => team.name === '2-1').rank, 6);
  assert.equal(rows.find(team => team.name === '2-3').rank, 7);
});

test('all teams finish with 11 played and zero remaining; schedules do not affect totals', () => {
  const matches = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({ id: matches.length + 1, date: '2026-10-20', time: '12:40', home: teams[i], away: teams[j], homeSets: null, awaySets: null });
    }
  }
  assert.ok(standings(matches).every(t => t.total === 0 && t.remaining === 11));
  for (const match of matches) { match.homeSets = 2; match.awaySets = 1; }
  assert.ok(standings(matches).every(t => t.total === 11 && t.remaining === 0));
  matches[0].homeSets = 0; matches[0].awaySets = 2;
  assert.ok(standings(matches).every(t => t.total === 11 && t.remaining === 0));
});

test('authentication, schedule, results, corrections and persistent storage', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sports-test-'));
  const port = 32000 + Math.floor(Math.random() * 10000);
  const password = 'integration-test-password';
  let child;
  async function start() {
    child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), DATA_DIR: directory, ADMIN_PASSWORD: password, SEED_2026_SAMPLE: 'false' }, stdio: ['ignore','pipe','pipe'] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
      child.stdout.on('data', chunk => { if (chunk.toString().includes('ready')) { clearTimeout(timeout); resolve(); } });
      child.on('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}`)); });
    });
  }
  async function stop() { const exited = once(child, 'exit'); child.kill(); await exited; }
  let cookie = '';
  async function request(route, method = 'GET', body, auth = true) {
    return fetch(`http://localhost:${port}/api${route}`, {
      method, headers: { 'Content-Type': 'application/json', ...(auth && cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  try {
    await start();
    let state = await (await request('/state')).json();
    assert.equal(state.admin, false);
    assert.equal(state.matches.length, 0);
    assert.equal(state.activeSeason, 2026);
    const archive2025 = state.seasons.find(season => season.year === 2025);
    assert.equal(archive2025.estimated, true);
    assert.equal(archive2025.standings[0].name, '3-3');
    assert.equal(archive2025.standings[1].name, '2-1');
    assert.ok(state.seasons.find(season => season.year === 2026).standings.every(team => team.total === 0));
    const schedule = { date: state.today, time: '12:40', home: '1-1', away: '1-2' };
    assert.equal((await request('/matches','POST', schedule)).status, 401);
    assert.equal((await request('/login','POST',{ username:'admin', password:'wrong' })).status, 401);
    const login = await request('/login','POST',{ username:'admin', password });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/standings', 'PUT', { season: 2025, teams: [] })).status, 400);
    assert.equal((await request('/matches','POST',{ ...schedule, date: '2026-02-30' })).status, 400);
    assert.equal((await request('/matches','POST',{ ...schedule, away: '1-1' })).status, 400);
    const created = await request('/matches','POST',schedule);
    assert.equal(created.status, 201);
    const { id } = await created.json();
    assert.equal((await request(`/matches/${id}`, 'PATCH', { time: '12:50', home: '1-1', away: '1-2' }, false)).status, 401);
    assert.equal((await request(`/matches/${id}`, 'PATCH', { time: '12:50', home: '1-1', away: '1-1' })).status, 400);
    assert.equal((await request(`/matches/${id}`, 'PATCH', { time: '12:50', home: '1-1', away: '1-3' })).status, 200);
    const editedState = await (await request('/state')).json();
    assert.equal(editedState.matches.length, 1);
    assert.equal(editedState.matches[0].away, '1-3');
    assert.equal(editedState.matches[0].time, '12:50');
    assert.equal((await request(`/matches/${id}`, 'PATCH', schedule)).status, 200);
    assert.equal((await request('/matches','POST',{ ...schedule, home:'1-2', away:'1-1' })).status, 409);
    state = await (await request('/state')).json();
    assert.equal(state.standings.find(t => t.name === '1-1').remaining, 11);
    assert.equal((await request(`/matches/${id}/result`,'PUT',{ homeSets:2,awaySets:1 },false)).status, 401);
    assert.equal((await request(`/matches/${id}/result`,'PUT',{ homeSets:2,awaySets:2 })).status, 400);
    assert.equal((await request(`/matches/${id}/result`,'PUT',{ homeSets:2,awaySets:1 })).status, 200);
    state = await (await request('/state')).json();
    let home = state.standings.find(t => t.name === '1-1');
    let away = state.standings.find(t => t.name === '1-2');
    assert.deepEqual([home.total,home.remaining,home.win,home.point,home.difference], [1,10,1,6,1]);
    assert.deepEqual([away.total,away.remaining,away.lose,away.point,away.difference], [1,10,1,3,-1]);
    await request(`/matches/${id}/result`,'PUT',{ homeSets:0,awaySets:2 });
    await request(`/matches/${id}/result`,'PUT',{ homeSets:0,awaySets:2 });
    state = await (await request('/state')).json();
    home = state.standings.find(t => t.name === '1-1');
    away = state.standings.find(t => t.name === '1-2');
    assert.deepEqual([home.total,home.win,home.lose,home.point], [1,0,1,0]);
    assert.deepEqual([away.total,away.win,away.lose,away.point], [1,1,0,6]);
    assert.equal((await request(`/matches/${id}`,'DELETE')).status, 409);
    assert.equal((await request(`/matches/${id}`, 'PATCH', schedule)).status, 409);
    const future = await (await request('/matches','POST',{ ...schedule,date:'2099-01-01' })).json();
    assert.equal((await request(`/matches/${future.id}/result`,'PUT',{ homeSets:2,awaySets:0 })).status, 400);
    assert.equal((await request(`/matches/${future.id}`,'DELETE')).status, 200);
    await stop(); await start();
    state = await (await request('/state')).json();
    assert.equal(state.matches.length, 1);
    assert.equal(state.matches[0].awaySets, 2);
    for (let i = 2; i < teams.length; i++) {
      const next = await (await request('/matches', 'POST', { ...schedule, time: `13:${String(i).padStart(2, '0')}`, away: teams[i] })).json();
      assert.equal((await request(`/matches/${next.id}/result`, 'PUT', { homeSets: 2, awaySets: 0 })).status, 200);
    }
    state = await (await request('/state')).json();
    home = state.standings.find(t => t.name === '1-1');
    assert.deepEqual([home.total, home.remaining], [11, 0]);
    const extra = await (await request('/matches', 'POST', { ...schedule, time: '14:00', home: '1-3', away: '1-1' })).json();
    assert.equal((await request(`/matches/${extra.id}/result`, 'PUT', { homeSets: 2, awaySets: 0 })).status, 409);
    assert.equal((await request(`/matches/${id}/result`, 'PUT', { homeSets: 2, awaySets: 1 })).status, 200);
    state = await (await request('/state')).json();
    assert.equal(state.standings.find(t => t.name === '1-1').total, 11);
    assert.equal(state.standings.find(t => t.name === '1-3').total, 1);
    const manual = { total: 7, remaining: 4, win: 4, lose: 3 };
    assert.equal((await request('/standings/3-3', 'PUT', manual, false)).status, 401);
    assert.equal((await request('/standings/unknown', 'PUT', manual)).status, 404);
    assert.equal((await request('/standings/3-3', 'PUT', { ...manual, win: -1 })).status, 400);
    assert.equal((await request('/standings/3-3', 'PUT', { ...manual, total: 1.5 })).status, 400);
    assert.equal((await request('/standings/3-3', 'PUT', { ...manual, total: 6 })).status, 400);
    assert.equal((await request('/standings/3-3', 'PUT', manual)).status, 200);
    assert.equal((await request('/standings/3-3', 'PUT', manual)).status, 200);
    await stop(); await start();
    state = await (await request('/state')).json();
    let corrected = state.standings.find(t => t.name === '3-3');
    assert.deepEqual([corrected.total,corrected.remaining,corrected.win,corrected.lose,corrected.point], [7,4,4,3,24]);
    const followup = await (await request('/matches', 'POST', { ...schedule, time: '15:00', home: '3-3', away: '3-4' })).json();
    assert.equal((await request(`/matches/${followup.id}/result`, 'PUT', { homeSets: 2, awaySets: 1 })).status, 200);
    state = await (await request('/state')).json();
    corrected = state.standings.find(t => t.name === '3-3');
    assert.deepEqual([corrected.total,corrected.remaining,corrected.win,corrected.lose,corrected.point], [8,3,5,3,30]);
    assert.equal((await request('/standings/3-3', 'PUT', { ...manual, expected: manual })).status, 409);
    assert.equal((await request(`/matches/${followup.id}/result`, 'PUT', { homeSets: 0, awaySets: 2 })).status, 200);
    state = await (await request('/state')).json();
    corrected = state.standings.find(t => t.name === '3-3');
    assert.deepEqual([corrected.total,corrected.remaining,corrected.win,corrected.lose,corrected.point], [8,3,4,4,24]);
    assert.equal(state.matches.find(m => m.id === followup.id).awaySets, 2);
    const other = state.standings.find(t => t.name === '3-4');
    const batch = { teams: [{ ...corrected, total: corrected.total + 1, remaining: corrected.remaining - 1, win: corrected.win + 1, winScore: corrected.winScore + 2, expected: corrected }, { ...other, total: other.total + 1, remaining: other.remaining - 1, expected: other }] };
    assert.equal((await request('/standings', 'PUT', { teams: [batch.teams[0], { ...batch.teams[1], total: 0 }] })).status, 400);
    assert.equal((await request('/standings', 'PUT', batch, false)).status, 401);
    assert.equal((await request('/standings', 'PUT', { teams: [batch.teams[0], batch.teams[0]] })).status, 400);
    assert.equal((await request('/standings', 'PUT', { teams: [batch.teams[0], { ...batch.teams[1], expected: { ...other, win: 999 } }] })).status, 409);
    state = await (await request('/state')).json();
    assert.equal(state.standings.find(t => t.name === '3-3').point, 24);
    assert.equal((await request('/standings', 'PUT', batch)).status, 200);
    state = await (await request('/state')).json();
    assert.equal(state.standings.find(t => t.name === '3-3').point, 30);
    assert.equal(state.standings.find(t => t.name === '3-4').total, other.total + 1);
    assert.equal((await request('/standings', 'PUT', batch)).status, 409);
    await stop(); await start();
    state = await (await request('/state')).json();
    assert.equal(state.standings.find(t => t.name === '3-3').point, 30);
    // Persist the exact click order, including edits with unchanged numeric totals.
    const manualTeam = state.standings.find(t => t.name === '3-1');
    const sequence = ['승', '패', '패', '승', '승', '패', '승'];
    const orderedUpdate = { ...manualTeam, total: manualTeam.total + sequence.length,
      remaining: Math.max(0, manualTeam.remaining - sequence.length),
      win: manualTeam.win + 4, lose: manualTeam.lose + 3, expected: manualTeam,
      resultChanges: sequence.map(result => ({ result, delta: 1 })) };
    const unchangedTeam = state.standings.find(t => t.name === '3-2');
    assert.equal((await request('/standings', 'PUT', { teams: [orderedUpdate,
      { ...unchangedTeam, expected: unchangedTeam, resultChanges: [{ result: '승', delta: 1 }] }] })).status, 400);
    state = await (await request('/state')).json();
    assert.deepEqual(state.standings.find(t => t.name === '3-1'), manualTeam);
    assert.equal((await request('/standings', 'PUT', { teams: [orderedUpdate] })).status, 200);
    state = await (await request('/state')).json();
    let ordered = state.standings.find(t => t.name === '3-1');
    assert.deepEqual(ordered.recent, sequence.slice(-5));
    const reorder = { ...ordered, expected: ordered, resultChanges: [{ result: '패', delta: -1 }, { result: '패', delta: 1 }] };
    assert.equal((await request('/standings', 'PUT', { teams: [reorder] })).status, 200);
    // The numeric totals match, but the history version changed.
    assert.equal((await request('/standings', 'PUT', { teams: [reorder] })).status, 409);
    await stop(); await start();
    state = await (await request('/state')).json();
    ordered = state.standings.find(t => t.name === '3-1');
    assert.deepEqual(ordered.recent, ['패', '승', '승', '승', '패']);
    assert.equal(ordered.win, orderedUpdate.win);
    const realMatch = await (await request('/matches', 'POST', { ...schedule, time: '16:20', home: '3-1', away: '3-2' })).json();
    assert.equal((await request(`/matches/${realMatch.id}/result`, 'PUT', { homeSets: 2, awaySets: 1 })).status, 200);
    state = await (await request('/state')).json();
    assert.deepEqual(state.standings.find(t => t.name === '3-1').recent, ['승', '승', '승', '패', '승']);
    assert.equal((await request(`/matches/${realMatch.id}/result`, 'PUT', { homeSets: 0, awaySets: 2 })).status, 200);
    state = await (await request('/state')).json();
    assert.deepEqual(state.standings.find(t => t.name === '3-1').recent, ['승', '승', '승', '패', '패']);
    // Set corrections are independent of match wins/losses and never create recent results.
    const beforeSets = state.standings.find(t => t.name === '3-1');
    const setUpdate = { ...beforeSets, winScore: beforeSets.winScore + 1, loseScore: beforeSets.loseScore + 1, expected: beforeSets, resultChanges: [] };
    assert.equal((await request('/standings', 'PUT', { teams: [{ ...setUpdate, winScore: -1 }] })).status, 400);
    assert.equal((await request('/standings/3-1', 'PUT', { ...setUpdate, loseScore: 1.5 })).status, 400);
    assert.equal((await request('/standings', 'PUT', { teams: [setUpdate] }, false)).status, 401);
    assert.equal((await request('/standings', 'PUT', { teams: [setUpdate] })).status, 200);
    await stop(); await start();
    state = await (await request('/state')).json();
    const afterSets = state.standings.find(t => t.name === '3-1');
    assert.equal(afterSets.point, (beforeSets.winScore + 1) * 3);
    assert.equal(afterSets.loseScore, beforeSets.loseScore + 1);
    assert.equal(afterSets.win, beforeSets.win);
    assert.equal(afterSets.lose, beforeSets.lose);
    assert.deepEqual(afterSets.recent, beforeSets.recent);
    assert.equal((await request('/standings', 'PUT', { teams: [setUpdate] })).status, 409);
    const nextSetMatch = await (await request('/matches', 'POST', { ...schedule, time: '16:30', home: '3-1', away: '3-2' })).json();
    assert.equal((await request(`/matches/${nextSetMatch.id}/result`, 'PUT', { homeSets: 2, awaySets: 0 })).status, 200);
    state = await (await request('/state')).json();
    assert.equal(state.standings.find(t => t.name === '3-1').winScore, afterSets.winScore + 2);
    assert.equal(state.standings.find(t => t.name === '3-1').point, afterSets.point + 6);
    assert.deepEqual(state.seasons.find(season => season.year === 2025), archive2025);
    assert.deepEqual(state.seasons.find(season => season.year === 2026).standings, state.standings);
    await request('/logout', 'POST');
    assert.equal((await request('/matches','POST',schedule)).status, 401);
  } finally {
    if (child && child.exitCode === null) await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
