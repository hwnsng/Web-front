import { useState } from 'react';
import { MATCH_TIME_LABEL, useLeague } from '../../league';
import MatchCard from '../../components/MatchCard';
import DayScheduleEditor from '../../components/DayScheduleEditor';
import { Link } from 'react-router-dom';
export default function WeekMatchPage() {
  const { data } = useLeague();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  if (!data) return <main className="sports-page">일정을 불러오는 중입니다.</main>;
  const monday = new Date(`${data.today}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const days = ['월', '화', '수', '목', '금'].map((name, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    return { name, date: day.toISOString().slice(0, 10), label: `${day.getUTCMonth() + 1}/${day.getUTCDate()}` };
  });
  const monthStart = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), 1));
  const weekNumber = Math.ceil((monday.getUTCDate() + (monthStart.getUTCDay() + 6) % 7) / 7);
  return <main className="sports-page">
    <h1><span>스포츠 클럽</span> 경기 일정</h1>
    <div className="weekly-heading">
      <div><h2>이번 주 · {monday.getUTCMonth() + 1}월 {weekNumber}주차</h2>
        <p>{monday.getUTCFullYear()}년 {days[0].label} (월) ~ {days[4].label} (금)</p>
      </div>
      <Link className="schedule-link-button" to="/todayMatchPage">오늘 경기 일정 보기</Link>
    </div>
    {data.admin && <p className="weekly-admin-help">요일 박스를 눌러 경기 일정을 추가하거나 수정하세요.</p>}
    <div className="weekly-schedule">
      {days.map(day => {
        const matches = data.matches.filter(m => m.date === day.date);
        const heading = <div className="weekly-day-heading"><h3>{day.name}요일</h3><span>{day.label}</span>{day.date === data.today && <span className="badge">오늘</span>}</div>;
        return <section key={day.date} className={`weekly-day${day.date === data.today ? ' is-today' : ''}${data.admin ? ' weekly-day-admin' : ''}`} aria-label={`${day.label} ${day.name}요일`}>
          {data.admin ? <button type="button" className="weekly-day-trigger" aria-label={`${day.name}요일 일정 관리`} aria-haspopup="dialog" onClick={() => setSelectedDate(day.date)}>
            {heading}
            <div className="weekly-day-content">
              {matches.length ? matches.map(match => <div className="weekly-match-preview" key={match.id}>
                <span className="weekly-match-time">{MATCH_TIME_LABEL} · {match.homeSets === null ? '예정' : '종료'}</span>
                <strong>{match.home} <span>{match.homeSets === null ? 'VS' : `${match.homeSets}:${match.awaySets}`}</span> {match.away}</strong>
              </div>) : <div className="weekly-no-match"><span>+<br />경기 일정 추가</span></div>}
              {matches.length > 0 && <span className="weekly-edit-hint">일정 관리 ↗</span>}
            </div>
          </button> : <>{heading}<div className="weekly-day-content">{matches.length ? matches.map(m => <MatchCard key={m.id} match={m} />) : <p className="weekly-no-match">예정된 경기가 없습니다.</p>}</div></>}
        </section>;
      })}
    </div>
    {data.admin && selectedDate && <DayScheduleEditor key={selectedDate} date={selectedDate} matches={data.matches.filter(match => match.date === selectedDate)} onClose={() => setSelectedDate(null)} />}
  </main>;
}
