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
    child = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(port), DATA_DIR: directory, ADMIN_PASSWORD: password }, stdio: ['ignore','pipe','pipe'] });
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
    const schedule = { date: state.today, time: '12:40', home: '1-1', away: '1-2' };
    assert.equal((await request('/matches','POST', schedule)).status, 401);
    assert.equal((await request('/login','POST',{ username:'admin', password:'wrong' })).status, 401);
    const login = await request('/login','POST',{ username:'admin', password });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    cookie = login.headers.get('set-cookie').split(';')[0];
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
    const batch = { teams: [{ ...corrected, total: corrected.total + 1, remaining: corrected.remaining - 1, win: corrected.win + 1, expected: corrected }, { ...other, total: other.total + 1, remaining: other.remaining - 1, expected: other }] };
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
    await request('/logout', 'POST');
    assert.equal((await request('/matches','POST',schedule)).status, 401);
  } finally {
    if (child && child.exitCode === null) await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
