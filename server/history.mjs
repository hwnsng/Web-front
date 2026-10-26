export function matchHistory(matches, name) {
  return [...matches].filter(match => match.homeSets !== null && [match.home, match.away].includes(name))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.id - b.id)
    .map(match => ({ matchId: match.id, result: (match.home === name ? match.homeSets > match.awaySets : match.awaySets > match.homeSets) ? '승' : '패', count: 1 }));
}

// Keep the entire history, compressing consecutive manual results into runs.
export function applyResultChanges(history, changes) {
  const next = history.map(entry => ({ ...entry }));
  for (const { result, delta } of changes) {
    if (delta > 0) {
      const last = next.at(-1);
      if (last && last.matchId === undefined && last.result === result) last.count += delta;
      else next.push({ result, count: delta });
    } else {
      let remaining = -delta;
      for (let index = next.length - 1; index >= 0 && remaining; index--) {
        if (next[index].result !== result) continue;
        const removed = Math.min(remaining, next[index].count);
        remaining -= removed;
        next[index].count -= removed;
        if (!next[index].count) next.splice(index, 1);
      }
    }
  }
  return next;
}

export function recentResults(history) {
  const recent = [];
  for (let index = history.length - 1; index >= 0 && recent.length < 5; index--) {
    const entry = history[index];
    recent.unshift(...Array(Math.min(entry.count, 5 - recent.length)).fill(entry.result));
  }
  return recent;
}

export function currentStreak(history) {
  const result = history.at(-1)?.result;
  let count = 0;
  for (let index = history.length - 1; index >= 0 && history[index].result === result; index--) count += history[index].count;
  return { result: result ?? null, count };
}

export function resultChanges(update, current) {
  if (update.resultChanges === undefined) {
    return [{ result: '승', delta: update.win - current.win }, { result: '패', delta: update.lose - current.lose }].filter(change => change.delta);
  }
  const changes = update.resultChanges;
  let wins = current.win, losses = current.lose;
  if (!Array.isArray(changes) || changes.length > 1000 || changes.some(change => {
    if (!change || !['승', '패'].includes(change.result) || ![1, -1].includes(change.delta)) return true;
    if (change.result === '승') wins += change.delta;
    else losses += change.delta;
    return wins < 0 || losses < 0;
  }) || wins !== update.win || losses !== update.lose) {
    throw Object.assign(new Error('승패 입력 순서와 변경된 경기 기록을 확인해주세요.'), { status: 400 });
  }
  return changes;
}
