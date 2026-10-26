import { recentResults, currentStreak } from './history.mjs';
export const teams = Array.from({ length: 12 }, (_, i) => `${Math.floor(i / 4) + 1}-${i % 4 + 1}`);
export const matchesPerTeam = 11;
export function standings(matches, adjustments = [], histories = []) {
  const rows = teams.map(name => ({ name, total: 0, remaining: matchesPerTeam, win: 0, lose: 0, point: 0, winScore: 0, loseScore: 0, difference: 0, recent: [] }));
  for (const match of [...matches].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.id - b.id)) {
    for (const [name, own, other] of [[match.home, match.homeSets, match.awaySets], [match.away, match.awaySets, match.homeSets]]) {
      const row = rows.find(t => t.name === name);
      if (own === null) continue;
      row.total++;
      row.remaining = Math.max(0, matchesPerTeam - row.total);
      row.win += Number(own > other);
      row.lose += Number(own < other);
      row.point += own * 3;
      row.winScore += own;
      row.loseScore += other;
      row.difference = row.winScore - row.loseScore;
      row.recent = [own > other ? '승' : '패', ...row.recent];
    }
  }
  for (const row of rows) {
    const history = histories.find(item => item.name === row.name);
    row.historyVersion = history?.revision ?? 0;
    const entries = history ? JSON.parse(history.entries) : row.recent.reverse().map(result => ({ result, count: 1 }));
    row.recent = recentResults(entries);
    row.streak = currentStreak(entries);
    const adjustment = adjustments.find(item => item.name === row.name);
    if (adjustment) {
      row.winScore = Math.max(0, row.winScore + adjustment.win * 2 + (adjustment.winSets ?? 0));
      row.loseScore = Math.max(0, row.loseScore + adjustment.lose * 2 + (adjustment.loseSets ?? 0));
      for (const field of ['total', 'remaining', 'win', 'lose']) {
        row[field] = Math.max(0, row[field] + adjustment[field]);
      }
    }
    row.point = row.winScore * 3;
    row.difference = row.winScore - row.loseScore;
  }
  rows.sort((a, b) => b.point - a.point || a.total - b.total || a.name.localeCompare(b.name));
  return rows.map(row => ({ ...row, rank: rows.findIndex(t => t.point === row.point && t.total === row.total) + 1 }));
}
export function validResult(a, b) {
  return Number.isInteger(a) && Number.isInteger(b) && ((a === 2 && [0, 1].includes(b)) || (b === 2 && [0, 1].includes(a)));
}
export function koreaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
