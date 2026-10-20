export const teams = Array.from({ length: 12 }, (_, i) => `${Math.floor(i / 4) + 1}-${i % 4 + 1}`);
export const matchesPerTeam = 11;
export function standings(matches, adjustments = []) {
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
      row.recent = [own > other ? '승' : '패', ...row.recent].slice(0, 5);
    }
  }
  for (const row of rows) {
    const adjustment = adjustments.find(item => item.name === row.name);
    if (adjustment) {
      row.point = Math.max(0, row.point + adjustment.win * 6);
      for (const field of ['total', 'remaining', 'win', 'lose']) {
        row[field] = Math.max(0, row[field] + adjustment[field]);
      }
    }
  }
  rows.sort((a, b) => b.point - a.point || b.difference - a.difference || a.name.localeCompare(b.name));
  return rows.map(row => ({ ...row, rank: rows.findIndex(t => t.point === row.point && t.difference === row.difference) + 1 }));
}
export function validResult(a, b) {
  return Number.isInteger(a) && Number.isInteger(b) && ((a === 2 && [0, 1].includes(b)) || (b === 2 && [0, 1].includes(a)));
}
export function koreaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
