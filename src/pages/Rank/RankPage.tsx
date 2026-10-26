import { api, useLeague, type Team } from '../../league';
import './RankPage.css';
import { useState } from 'react';

type EditableField = 'total' | 'win' | 'lose' | 'winScore' | 'loseScore';
type ResultChange = { result: '승' | '패'; delta: number };
type DraftTeam = Team & { resultChanges: ResultChange[]; setWinOffset: number; setLoseOffset: number };
const labels = { total: '경기 수', win: '승리', lose: '패배', winScore: '세트 승리', loseScore: '세트 패배' };
export default function RankPage() {
  const { data, refresh } = useLeague();
  const [draft, setDraft] = useState<DraftTeam[] | null>(null);
  const [baseline, setBaseline] = useState<Team[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = !!data?.admin && draft !== null;
  const rows = editing ? draft : data?.standings ?? [];
  function startEditing() {
    if (!data) return;
    setBaseline(data.standings.map(team => ({ ...team })));
    setDraft(data.standings.map(team => ({ ...team, resultChanges: [], setWinOffset: 0, setLoseOffset: 0 })));
    setError('');
  }
  function change(name: string, field: EditableField, delta: number) {
    setDraft(current => current?.map(team => {
      if (team.name !== name) return team;
      const next = Math.max(0, Math.min(1000000, team[field] + delta));
      if (next === team[field]) return team;
      const updated = { ...team, [field]: next };
      if ((field === 'win' || field === 'lose' || field === 'total') && updated.win + updated.lose > updated.total && !(delta < 0 && field !== 'total') && !(delta > 0 && field === 'total')) return team;
      const original = baseline.find(row => row.name === name)!;
      if (field === 'total') updated.remaining = Math.max(0, original.remaining - (next - original.total));
      else if (field === 'win' || field === 'lose') {
        updated.resultChanges = [...team.resultChanges, { result: field === 'win' ? '승' : '패', delta }];
      }
      if (field === 'winScore') updated.setWinOffset = next - original.winScore - (updated.win - original.win) * 2;
      if (field === 'loseScore') updated.setLoseOffset = next - original.loseScore - (updated.lose - original.lose) * 2;
      updated.winScore = Math.max(0, original.winScore + (updated.win - original.win) * 2 + updated.setWinOffset);
      updated.loseScore = Math.max(0, original.loseScore + (updated.lose - original.lose) * 2 + updated.setLoseOffset);
      updated.point = updated.winScore * 3;
      updated.difference = updated.winScore - updated.loseScore;
      return updated;
    }) ?? null);
  }
  async function save() {
    if (!draft) return;
    const changed = draft.filter(team => {
      const previous = baseline.find(row => row.name === team.name)!;
      return team.resultChanges.length > 0 || (['total', 'remaining', 'win', 'lose', 'winScore', 'loseScore'] as const).some(field => team[field] !== previous[field]);
    });
    if (!changed.length) { setDraft(null); return; }
    setBusy(true); setError('');
    try {
      await api('/standings', 'PUT', { teams: changed.map(team => ({ name: team.name, total: team.total, remaining: team.remaining, win: team.win, lose: team.lose, winScore: team.winScore, loseScore: team.loseScore, resultChanges: team.resultChanges, expected: baseline.find(row => row.name === team.name) })) });
      await refresh(); setDraft(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function numberCell(team: Team, field: EditableField) {
    if (!editing) return team[field];
    return <div className="standing-stepper">
      <button type="button" disabled={busy || team[field] === 0 || (field === 'total' && team.total <= team.win + team.lose)} aria-label={`${team.name} ${labels[field]} 감소`} onClick={() => change(team.name, field, -1)}>−</button>
      <span aria-live="polite">{team[field]}</span>
      <button type="button" disabled={busy || team[field] >= 1000000 || ((field === 'win' || field === 'lose') && (team.win + team.lose >= team.total || (field === 'win' ? team.winScore : team.loseScore) > 999998))} aria-label={`${team.name} ${labels[field]} 증가`} onClick={() => change(team.name, field, 1)}>+</button>
    </div>;
  }
  return <main className="sports-page standings-page">
    <div className="standings-heading"><div><p className="standings-eyebrow">LEAGUE STANDINGS</p><h1>리그 순위</h1></div></div>
    <section className="standings-panel" aria-label="리그 순위표">
      <div className="standings-toolbar"><h2>팀 순위</h2>{data?.admin && <div className="standings-edit-actions">
        {editing ? <><button className="secondary" disabled={busy} onClick={() => { setDraft(null); setError(''); }}>취소</button><button disabled={busy || rows.some(team => team.win + team.lose > team.total)} onClick={() => void save()}>{busy ? '저장 중…' : '저장'}</button></> : <button onClick={startEditing}>수정</button>}
      </div>}</div>
      {editing && <p className="standings-edit-help">승리 + 패배는 경기 수를 넘을 수 없습니다. 경기 승패 +1에는 해당 세트 2개가 기본 반영됩니다. 세트 수는 따로 조정할 수 있으며 승점은 세트 승리 × 3입니다.</p>}
      {error && <p className="form-error standings-edit-help" role="alert">{error}</p>}
      <div className="standings-scroll" tabIndex={0} role="region" aria-label="팀별 순위와 경기 기록, 작은 화면에서는 좌우로 스크롤하세요">
        <table className={`standings-table${editing ? ' is-editing' : ''}`}>
          <caption className="standings-sr-only">팀별 경기 수, 승리, 패배, 승점, 연속 승패</caption>
          <thead><tr>{['순위', '팀', '경기 수', '승리', '패배', ...(editing ? ['세트 승리', '세트 패배'] : []), '승점', '연속'].map(title => <th scope="col" key={title} className={title === '승점' ? 'standings-points' : ''}>{title}</th>)}</tr></thead>
          <tbody>{rows.map(team => <tr key={team.name} className={team.rank <= 3 && team.total > 0 ? 'standings-top-team' : ''}>
            <td className="standings-position"><span className={`position-number${team.rank <= 3 && team.total > 0 ? ` podium-position podium-${team.rank}` : ''}`}>{String(team.rank).padStart(2, '0')}</span></td>
            <th scope="row" className="standings-team">{team.name}</th>
            <td className="standings-played">{numberCell(team, 'total')}</td>
            <td className="standings-wins">{numberCell(team, 'win')}</td><td className="standings-secondary standings-losses">{numberCell(team, 'lose')}</td>
            {editing && <><td>{numberCell(team, 'winScore')}</td><td>{numberCell(team, 'loseScore')}</td></>}
            <td className="standings-points"><strong>{team.point}</strong></td>
            <td className={`standings-streak${team.streak?.result === '승' ? ' streak-win' : team.streak?.result === '패' ? ' streak-loss' : ''}`}>
              {team.streak?.count ? `${team.streak.count}${team.streak.result}` : '–'}
            </td>
          </tr>)}</tbody>
        </table>
        {!data && <p className="standings-loading" role="status">순위를 불러오는 중입니다.</p>}
      </div>
      <div className="standings-footer"><span>기본 일정은 팀당 11경기입니다.</span><span className="standings-scroll-hint">좌우로 밀어 전체 기록 보기 ↔</span></div>
    </section>
  </main>;
}
