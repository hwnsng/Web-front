import { dateLabel, useLeague } from '../../league';
import MatchCard from '../../components/MatchCard';
import { Link } from 'react-router-dom';
export default function TodayMatchPage() {
  const { data } = useLeague();
  if (!data) return <main className="sports-page">경기를 불러오는 중입니다.</main>;
  const matches = data.matches.filter(m => m.date === data.today);
  return <main className="sports-page">
    <h1><span>오늘</span> 경기</h1><p>{dateLabel(data.today, true)}</p>
    {matches.length ? <div className="match-grid">{matches.map(m => <MatchCard key={m.id} match={m} />)}</div> : (
      <div className="empty-state today-empty-state">
        <h2>오늘 등록된 경기가 없습니다.</h2>
        <Link className="schedule-link-button" to="/weekMatchPage">경기 일정 보기</Link>
      </div>
    )}
  </main>;
}
