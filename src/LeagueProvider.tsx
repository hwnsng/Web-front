import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, LeagueContext, type State } from './league';
import { useLocation } from 'react-router-dom';
export default function LeagueProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [data, setData] = useState<State | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try { setData(await api('/state')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : '서버에 연결할 수 없습니다.'); }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [refresh]);
  return <LeagueContext.Provider value={{ data, error, refresh }}>
    {error && pathname !== '/loginPage' && <div className="server-error" role="alert">데이터 연결 오류: {error} <button onClick={() => void refresh()}>다시 시도</button></div>}
    {children}
  </LeagueContext.Provider>;
}
