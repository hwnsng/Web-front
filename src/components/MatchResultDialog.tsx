import { useEffect, useId, useRef } from 'react';
import type { Match } from '../league';

export default function MatchResultDialog({ match, onClose }: { match: Match; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const winner = (match.homeSets ?? 0) > (match.awaySets ?? 0) ? match.home : match.away;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="match-result-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="match-result-content">
      <div className="match-result-top"><h2 id={titleId}>경기 결과</h2></div>
      <p className="match-result-winner"><strong>{winner}</strong> <span>WIN</span></p>
      <div className="match-result-scoreboard" role="group" aria-label="세트 스코어">
        <span>{match.home}</span><strong>{match.homeSets} : {match.awaySets}</strong><span>{match.away}</span>
      </div>
      <p className="match-result-caption">세트 스코어</p>
      <button type="button" className="match-result-close" onClick={onClose}>확인</button>
    </div>
  </dialog>;
}
