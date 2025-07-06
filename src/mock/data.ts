function createTeam(name: string, win: number, lose: number, winScore: number, loseScore: number) {
  return {
    name,
    win,
    lose,
    total: win + lose,
    point: win * 3,
    winScore,
    loseScore,
  };
}

export const TeamInfo = [
  createTeam("1-1", 3, 2, 7, 5),
  createTeam("1-2", 4, 2, 8, 6),
  createTeam("1-3", 1, 5, 4, 11),
  createTeam("1-4", 0, 6, 1, 12),
  createTeam("2-1", 5, 0, 10, 1),
  createTeam("2-2", 3, 2, 7, 5),
  createTeam("2-3", 2, 3, 4, 8),
  createTeam("2-4", 3, 2, 7, 5),
  createTeam("3-1", 1, 5, 4, 10),
  createTeam("3-2", 2, 3, 6, 6),
  createTeam("3-3", 5, 0, 10, 1),
  createTeam("3-4", 3, 2, 6, 4),
];

//recent1이 가장 최근경기, recent5가 가장 오래된 경기
export const RecentMatch = [
  { name: "1-1", recent1: "승", recent2: "패", recent3: "패", recent4: "승", recent5: "승" },
  { name: "1-2", recent1: "패", recent2: "승", recent3: "패", recent4: "승", recent5: "승" },
  { name: "1-3", recent1: "패", recent2: "패", recent3: "패", recent4: "패", recent5: "패" },
  { name: "1-4", recent1: "패", recent2: "패", recent3: "패", recent4: "패", recent5: "패" },
  { name: "2-1", recent1: "승", recent2: "승", recent3: "승", recent4: "승", recent5: "승" },
  { name: "2-2", recent1: "패", recent2: "승", recent3: "승", recent4: "패", recent5: "승" },
  { name: "2-3", recent1: "패", recent2: "승", recent3: "패", recent4: "승", recent5: "패" },
  { name: "2-4", recent1: "패", recent2: "승", recent3: "승", recent4: "승", recent5: "패" },
  { name: "3-1", recent1: "패", recent2: "패", recent3: "패", recent4: "패", recent5: "승" },
  { name: "3-2", recent1: "승", recent2: "패", recent3: "패", recent4: "승", recent5: "패" },
  { name: "3-3", recent1: "승", recent2: "승", recent3: "승", recent4: "승", recent5: "승" },
  { name: "3-4", recent1: "승", recent2: "패", recent3: "승", recent4: "패", recent5: "승" },
];

export const WeekMatch = [
  { name: 1, lunch: "2-4 vs 2-2" },
  { name: 2, lunch: "3-3 vs 2-1" },
  { name: 3, lunch: "3-4 vs 3-2" },
  { name: 4, lunch: "3-1 vs 1-2" },
  { name: 5, lunch: "1-3 vs 1-1" },
];
