import { api, useLeague, type Team } from '../../league';
import './RankPage.css';
import { useState } from 'react';

type EditableField = 'total' | 'win' | 'lose';
const labels = { total: '경기 수', win: '승리', lose: '패배' };
export default function RankPage() {
  const { data, refresh } = useLeague();
  const [draft, setDraft] = useState<Team[] | null>(null);
  const [baseline, setBaseline] = useState<Team[]>([]);
  const [actualWins, setActualWins] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = !!data?.admin && draft !== null;
  const rows = editing ? draft : data?.standings ?? [];
  function startEditing() {
    if (!data) return;
    setBaseline(data.standings.map(team => ({ ...team })));
    setDraft(data.standings.map(team => ({ ...team })));
    setActualWins(Object.fromEntries(data.teams.map(name => [name, data.matches.filter(match => (match.home === name && match.homeSets !== null && match.homeSets > (match.awaySets ?? 0)) || (match.away === name && match.awaySets !== null && match.awaySets > (match.homeSets ?? 0))).length])));
    setError('');
  }
  function change(name: string, field: EditableField, delta: number) {
    setDraft(current => current?.map(team => {
      if (team.name !== name) return team;
      const next = Math.max(0, Math.min(1000000, team[field] + delta));
      const updated = { ...team, [field]: next };
      if (updated.win + updated.lose > updated.total && !(delta < 0 && field !== 'total') && !(delta > 0 && field === 'total')) return team;
      const original = baseline.find(row => row.name === name)!;
      if (field === 'total') updated.remaining = Math.max(0, original.remaining - (next - original.total));
      // Use raw sets plus the absolute win adjustment so decrementing and restoring is reversible.
      updated.point = Math.max(0, original.winScore * 3 + (updated.win - actualWins[name]) * 6);
      return updated;
    }) ?? null);
  }
  async function save() {
    if (!draft) return;
    const changed = draft.filter(team => {
      const previous = baseline.find(row => row.name === team.name)!;
      return (['total', 'remaining', 'win', 'lose'] as const).some(field => team[field] !== previous[field]);
    });
    if (!changed.length) { setDraft(null); return; }
    setBusy(true); setError('');
    try {
      await api('/standings', 'PUT', { teams: changed.map(team => ({ name: team.name, total: team.total, remaining: team.remaining, win: team.win, lose: team.lose, expected: baseline.find(row => row.name === team.name) })) });
      await refresh(); setDraft(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function numberCell(team: Team, field: EditableField) {
    if (!editing) return team[field];
    return <div className="standing-stepper">
      <button type="button" disabled={busy || team[field] === 0 || (field === 'total' && team.total <= team.win + team.lose)} aria-label={`${team.name} ${labels[field]} 감소`} onClick={() => change(team.name, field, -1)}>−</button>
      <span aria-live="polite">{team[field]}</span>
      <button type="button" disabled={busy || team[field] >= 1000000 || (field !== 'total' && team.win + team.lose >= team.total)} aria-label={`${team.name} ${labels[field]} 증가`} onClick={() => change(team.name, field, 1)}>+</button>
    </div>;
  }
  return <main className="sports-page standings-page">
    <div className="standings-heading"><div><p className="standings-eyebrow">LEAGUE STANDINGS</p><h1>리그 순위</h1></div></div>
    <section className="standings-panel" aria-label="리그 순위표">
      <div className="standings-toolbar"><h2>팀 순위</h2>{data?.admin && <div className="standings-edit-actions">
        {editing ? <><button className="secondary" disabled={busy} onClick={() => { setDraft(null); setError(''); }}>취소</button><button disabled={busy || rows.some(team => team.win + team.lose > team.total)} onClick={() => void save()}>{busy ? '저장 중…' : '저장'}</button></> : <button onClick={startEditing}>수정</button>}
      </div>}</div>
      {editing && <p className="standings-edit-help">승리 + 패배는 경기 수를 넘을 수 없습니다. 경기 수 +1 → 남은 경기 −1 · 승리 +1 → 승점 +6. 저장하면 순위에 반영됩니다.</p>}
      {error && <p className="form-error standings-edit-help" role="alert">{error}</p>}
      <div className="standings-scroll" tabIndex={0} role="region" aria-label="팀별 순위와 경기 기록, 작은 화면에서는 좌우로 스크롤하세요">
        <table className={`standings-table${editing ? ' is-editing' : ''}`}>
          <caption className="standings-sr-only">팀별 경기 수, 남은 경기 수, 승리, 패배, 승점</caption>
          <thead><tr>{['순위', '팀', '경기 수', '남은 경기 수', '승리', '패배', '승점'].map((title, index) => <th scope="col" key={title} className={index === 6 ? 'standings-points' : ''}>{title}</th>)}</tr></thead>
          <tbody>{rows.map(team => <tr key={team.name} className={team.rank <= 3 && team.total > 0 ? 'standings-top-team' : ''}>
            <td className="standings-position"><span className={`position-number${team.rank <= 3 && team.total > 0 ? ` podium-position podium-${team.rank}` : ''}`}>{String(team.rank).padStart(2, '0')}</span></td>
            <th scope="row" className="standings-team">{team.name}</th>
            <td>{numberCell(team, 'total')}</td><td className="standings-secondary">{team.remaining}</td>
            <td className="standings-wins">{numberCell(team, 'win')}</td><td className="standings-secondary">{numberCell(team, 'lose')}</td>
            <td className="standings-points"><strong>{team.point}</strong></td>
          </tr>)}</tbody>
        </table>
        {!data && <p className="standings-loading" role="status">순위를 불러오는 중입니다.</p>}
      </div>
      <div className="standings-footer"><span>기본 일정은 팀당 11경기이며, 관리자 수정 사항이 반영됩니다.</span><span className="standings-scroll-hint">좌우로 밀어 전체 기록 보기 ↔</span></div>
    </section>
  </main>;
}
