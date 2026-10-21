import { useState } from 'react';
import { api, useLeague, type Match } from '../league';
export default function MatchCard({ match }: { match: Match }) {
  const { data, refresh } = useLeague();
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(`${match.homeSets ?? 2}:${match.awaySets ?? 0}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const completed = match.homeSets !== null;
  async function save() {
    setBusy(true); setError('');
    try {
      const [homeSets, awaySets] = score.split(':').map(Number);
      await api(`/matches/${match.id}/result`, 'PUT', { homeSets, awaySets });
      setEditing(false); await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('이 경기 일정을 삭제할까요?')) return;
    setBusy(true); setError('');
    try { await api(`/matches/${match.id}`, 'DELETE'); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <article className="sports-card">
    <h2>{match.home} <span className="vs">{completed ? `${match.homeSets} : ${match.awaySets}` : 'VS'}</span> {match.away}</h2>
    {completed && <p>{(match.homeSets ?? 0) > (match.awaySets ?? 0) ? match.home : match.away} 승리 · 세트 득실차 {Math.abs((match.homeSets ?? 0) - (match.awaySets ?? 0))}</p>}
    <div className="team-comparison">{[match.home, match.away].map(name => {
      const team = data?.standings.find(t => t.name === name);
      return team && <div key={name} className="team-form">
        <div className="team-form-heading"><strong>{name}</strong><span>{team.rank}위</span></div>
        <p>{team.win}승 {team.lose}패 · 승점 <b>{team.point}</b></p>
        <div className="recent-form-label">최근 5경기 <span>최신순</span></div>
        <div className="recent-form" aria-label={`${name} 최근 경기, 왼쪽부터 최신순`}>
          {Array.from({ length: 5 }, (_, index) => {
            const result = team.recent[index];
            return <span key={index} className={`form-result ${result === '승' ? 'form-win' : result === '패' ? 'form-loss' : 'form-empty'}`} aria-label={`${index + 1}번째 최근 경기: ${result || '기록 없음'}`} title={result || '기록 없음'}>{result || '–'}</span>;
          })}
        </div>
      </div>;
    })}</div>
    {data?.admin && <div className="admin-actions">
      {match.date <= data.today && !editing && <button onClick={() => { setScore(`${match.homeSets ?? 2}:${match.awaySets ?? 0}`); setEditing(true); }}>{completed ? '결과 수정' : '결과 입력'}</button>}
      {!completed && <button className="secondary" disabled={busy} onClick={() => void remove()}>일정 삭제</button>}
      {editing && <form onSubmit={e => { e.preventDefault(); void save(); }}>
        <label>세트 결과 ({match.home} : {match.away})
          <select value={score} onChange={e => setScore(e.target.value)}>
            {['2:0', '2:1', '0:2', '1:2'].map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <p>{score.startsWith('2') ? match.home : match.away} 승리 · 승점 {score.split(':').map(sets => Number(sets) * 3).join(' / ')}</p>
        <button disabled={busy} type="submit">{busy ? '저장 중…' : '결과 저장'}</button>
        <button className="secondary" type="button" disabled={busy} onClick={() => setEditing(false)}>취소</button>
      </form>}
    </div>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </article>;
}
