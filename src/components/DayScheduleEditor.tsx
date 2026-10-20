import { useEffect, useRef, useState } from 'react';
import { api, dateLabel, useLeague, type Match } from '../league';

export default function DayScheduleEditor({ date, matches, onClose }: { date: string; matches: Match[]; onClose: () => void }) {
  const { data, refresh } = useLeague();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<Match | null>(matches[0] ?? null);
  const [stage, setStage] = useState<'edit' | 'save' | 'cancel'>('edit');
  const completed = selected !== null && selected.homeSets !== null;
  const [home, setHome] = useState(matches[0]?.home ?? '1-1');
  const [away, setAway] = useState(matches[0]?.away ?? '1-2');
  const [time, setTime] = useState(matches[0]?.time ?? '12:40');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  function choose(match: Match | null) {
    setSelected(match); setHome(match?.home ?? '1-1'); setAway(match?.away ?? '1-2'); setTime(match?.time ?? '12:40'); setError('');
  }
  function requestClose() {
    if (busy) return;
    if (stage === 'save' || stage === 'cancel') setStage('edit');
    else setStage('cancel');
  }
  async function save() {
    setBusy(true); setError('');
    try {
      await api(selected ? `/matches/${selected.id}` : '/matches', selected ? 'PATCH' : 'POST', { date, time, home, away });
      await refresh(); onClose();
    } catch (e) { setError((e as Error).message); setStage('edit'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="day-editor-dialog" aria-labelledby="day-editor-title" onCancel={e => { e.preventDefault(); requestClose(); }}>
    <div className="day-editor-top"><span>경기 일정 관리</span><button type="button" className="secondary" aria-label="닫기" disabled={busy} onClick={requestClose}>✕</button></div>
    <h2 id="day-editor-title">{stage === 'save' ? '저장하시겠습니까?' : stage === 'cancel' ? '취소하시겠습니까?' : dateLabel(date, true)}</h2>
    {stage === 'save' ? <>
      <div className="day-editor-preview"><p>{dateLabel(date, true)} · {time}</p><strong>{home} <span>VS</span> {away}</strong></div>
      <p className="day-editor-help">{selected ? '기존 일정이 선택한 내용으로 변경됩니다.' : '선택한 날짜에 새 경기가 추가됩니다.'}</p>
      <div className="day-editor-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setStage('edit')}>돌아가기</button><button type="button" disabled={busy} onClick={() => void save()}>{busy ? '저장 중…' : '저장 확인'}</button></div>
    </> : stage === 'cancel' ? <>
      <p className="day-editor-help">변경한 내용은 저장되지 않습니다.</p>
      <div className="day-editor-actions"><button type="button" className="secondary" onClick={() => setStage('edit')}>계속 수정</button><button type="button" onClick={onClose}>취소 확인</button></div>
    </> : <>
      {matches.length > 0 && <label>관리할 경기
        <select value={selected?.id ?? 'new'} onChange={e => choose(matches.find(m => String(m.id) === e.target.value) ?? null)}>
          {matches.map(m => <option key={m.id} value={m.id}>{m.time} · {m.home} vs {m.away}{m.homeSets !== null ? ' (종료)' : ''}</option>)}
          <option value="new">새 경기 추가</option>
        </select>
      </label>}
      <form onSubmit={e => { e.preventDefault(); if (!completed && home !== away) setStage('save'); }}>
        <div className="day-editor-teams">
          <label>팀 A<select disabled={completed} value={home} onChange={e => setHome(e.target.value)}>{data?.teams.map(team => <option key={team}>{team}</option>)}</select></label>
          <span>VS</span>
          <label>팀 B<select disabled={completed} value={away} onChange={e => setAway(e.target.value)}>{data?.teams.map(team => <option key={team}>{team}</option>)}</select></label>
        </div>
        <label>시작 시간<input type="time" disabled={completed} required value={time} onChange={e => setTime(e.target.value)} /></label>
        {completed && <p className="day-editor-help">결과가 입력된 경기의 팀과 시간은 변경할 수 없습니다.</p>}
        {home === away && <p className="form-error" role="alert">서로 다른 반을 선택해주세요.</p>}
        <div className="day-editor-actions"><button type="button" className="secondary" onClick={() => setStage('cancel')}>취소</button><button type="submit" disabled={completed || home === away || !time}>확인</button></div>
      </form>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </dialog>;
}
