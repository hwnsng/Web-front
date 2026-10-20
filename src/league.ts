import { createContext, useContext } from 'react';
export interface Match { id: number; date: string; time: string; home: string; away: string; homeSets: number | null; awaySets: number | null }
export interface Team { name: string; rank: number; total: number; remaining: number; win: number; lose: number; point: number; winScore: number; loseScore: number; difference: number; recent: string[] }
export interface State { admin: boolean; today: string; teams: string[]; matches: Match[]; standings: Team[] }
export const LeagueContext = createContext<{ data: State | null; error: string; refresh: () => Promise<void> }>({ data: null, error: '', refresh: async () => {} });
export const useLeague = () => useContext(LeagueContext);
export async function api(url: string, method = 'GET', body?: unknown) {
  const response = await fetch(`/api${url}`, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json().catch(() => ({ error: '서버 응답을 확인할 수 없습니다.' }));
  if (!response.ok) throw new Error(result.error || '요청에 실패했습니다.');
  return result;
}
export const dateLabel = (date: string, includeYear = false) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...(includeYear ? { year: 'numeric' as const } : {}), month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${date}T12:00:00+09:00`));
