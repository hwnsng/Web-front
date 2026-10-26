import { useState } from 'react';
import { useLeague } from '../../league';
import DayScheduleEditor from '../../components/DayScheduleEditor';
import { Link } from 'react-router-dom';
export default function WeekMatchPage() {
  const { data } = useLeague();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  if (!data) return <main className="sports-page">일정을 불러오는 중입니다.</main>;
  const sunday = new Date(`${data.today}T00:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);
  const days = ['월', '화', '수', '목', '금'].map((name, index) => {
    const day = new Date(sunday);
    day.setUTCDate(sunday.getUTCDate() + index + 1);
    return { name, date: day.toISOString().slice(0, 10), label: `${day.getUTCMonth() + 1}/${day.getUTCDate()}` };
  });
  const monthStart = new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), 1));
  const weekNumber = Math.ceil((sunday.getUTCDate() + monthStart.getUTCDay()) / 7);
  return <main className="sports-page weekly-page">
    <div className="page-heading"><p className="page-eyebrow">MATCH SCHEDULE</p><h1><span>스포츠 클럽</span> 경기 일정</h1></div>
    <div className="weekly-heading">
      <div><h2>이번 주 · {sunday.getUTCMonth() + 1}월 {weekNumber}주차</h2>
        <p>{sunday.getUTCFullYear()}년 {sunday.getUTCMonth() + 1}/{sunday.getUTCDate()} (일) ~ {saturday.getUTCMonth() + 1}/{saturday.getUTCDate()} (토)</p>
      </div>
      <Link className="schedule-link-button" to="/todayMatchPage">오늘 경기 일정 보기</Link>
    </div>
    {data.admin && <p className="weekly-admin-help">요일 박스를 눌러 경기 일정을 추가하거나 수정하세요.</p>}
    <div className="weekly-schedule">
      {days.map(day => {
        const matches = data.matches.filter(m => m.date === day.date);
        const content = <div className="weekly-day-content">
          {matches.length ? matches.map(match => <div className="weekly-match-preview" key={match.id}>
            <strong><span className="weekly-team">{match.home}</span><span className="weekly-versus">VS</span><span className="weekly-team">{match.away}</span></strong>
          </div>) : <div className="weekly-no-match">{data.admin ? <span>+<br />경기 일정 추가</span> : '예정된 경기가 없습니다.'}</div>}
          {data.admin && matches.length > 0 && <span className="weekly-edit-hint">일정 관리 ↗</span>}
        </div>;
        const heading = <div className="weekly-day-heading"><h3>{day.name}요일</h3><span>{day.label}</span>{day.date === data.today && <span className="badge">오늘</span>}</div>;
        return <section key={day.date} className={`weekly-day${day.date === data.today ? ' is-today' : ''}${data.admin ? ' weekly-day-admin' : ''}`} aria-label={`${day.label} ${day.name}요일`}>
          {data.admin ? <button type="button" className="weekly-day-trigger" aria-label={`${day.name}요일 일정 관리`} aria-haspopup="dialog" onClick={() => setSelectedDate(day.date)}>
            {heading}
            {content}
          </button> : <>{heading}{content}</>}
        </section>;
      })}
    </div>
    {data.admin && selectedDate && <DayScheduleEditor key={selectedDate} date={selectedDate} matches={data.matches.filter(match => match.date === selectedDate)} onClose={() => setSelectedDate(null)} />}
  </main>;
}
