import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyResultChanges, recentResults, resultChanges, currentStreak } from './history.mjs';
import { standings } from './league.mjs';

test('streak uses the full history, including consecutive manual and recorded wins beyond five', () => {
  assert.deepEqual(currentStreak([]), { result: null, count: 0 });
  assert.deepEqual(currentStreak([{ result: '패', count: 2 }, { result: '승', count: 10 }, { matchId: 1, result: '승', count: 1 }]), { result: '승', count: 11 });
  assert.deepEqual(currentStreak([{ result: '승', count: 10 }, { result: '패', count: 2 }]), { result: '패', count: 2 });
  const matches = Array.from({ length: 7 }, (_, id) => ({ id, date: '2026-10-26', time: '12:50', home: '1-1', away: '1-2', homeSets: 2, awaySets: 0 }));
  const home = standings(matches).find(team => team.name === '1-1');
  assert.equal(home.recent.length, 5);
  assert.deepEqual(home.streak, { result: '승', count: 7 });
});

test('manual results retain input order and show the last five, with newest on the right', () => {
  const history = applyResultChanges([], ['승', '패', '패'].map(result => ({ result, delta: 1 })));
  assert.deepEqual(recentResults(history), ['승', '패', '패']);
  const extended = applyResultChanges(history, ['패', '승', '승', '패'].map(result => ({ result, delta: 1 })));
  assert.deepEqual(recentResults(extended), ['패', '패', '승', '승', '패']);
  assert.deepEqual(recentResults(applyResultChanges(extended, [{ result: '패', delta: -1 }])), ['패', '패', '패', '승', '승']);
  assert.deepEqual(recentResults(history), ['승', '패', '패']);
});

test('removing and restoring a run recovers older results beyond the visible five', () => {
  const history = [{ result: '패', count: 1 }, { result: '승', count: 1, matchId: 42 }];
  const extended = applyResultChanges(history, [{ result: '승', delta: 1000000 }]);
  assert.equal(extended.length, 3);
  assert.deepEqual(applyResultChanges(extended, [{ result: '승', delta: -1000000 }]), history);
  assert.deepEqual(recentResults(applyResultChanges(extended, [{ result: '승', delta: -1000001 }])), ['패']);
});

test('history changes must agree with win/loss totals and cannot decrement below zero', () => {
  assert.throws(() => resultChanges({ win: 1, lose: 0, resultChanges: [{ result: '패', delta: 1 }] }, { win: 0, lose: 0 }), { status: 400 });
  assert.throws(() => resultChanges({ win: 0, lose: 0, resultChanges: [{ result: '승', delta: -1 }, { result: '승', delta: 1 }] }, { win: 0, lose: 0 }), { status: 400 });
  assert.throws(() => resultChanges({ win: 0, lose: 0, resultChanges: 'invalid' }, { win: 0, lose: 0 }), { status: 400 });
});
