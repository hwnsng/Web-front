import '@/pages/Today/TodayMatchPage.css';
import { TeamInfo, RecentMatch, WeekMatch } from '../../mock/data.ts';

export default function TodayMatchPage() {
  const today = new Date();
  const koreaTime = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayIndex = koreaTime.getDay();

  const todayMatch = WeekMatch.find((w) => w.name === todayIndex);
  const lunchMatch = todayMatch?.lunch;

  const rankedTeams = [...TeamInfo]
    .sort((a, b) => b.point - a.point)
    .map((team) => team.name);

  const getTeamRank = (teamName: string) => {
    const teamPoint = TeamInfo.find(t => t.name === teamName)!.point;
    const samePointTeams = TeamInfo.filter(t => t.point === teamPoint).map(t => t.name);
    const firstIdx = rankedTeams.findIndex(name => samePointTeams.includes(name));
    return firstIdx + 1;
  };

  const getTeamData = (teamName: string) => {
    const team = TeamInfo.find((t) => t.name === teamName)!;
    const recent = RecentMatch.find((r) => r.name === teamName)!;
    return {
      ...team,
      recent: [recent.recent1, recent.recent2, recent.recent3, recent.recent4, recent.recent5],
      rank: getTeamRank(teamName),
    };
  };

  if (!lunchMatch) return null;

  const [leftName, rightName] = lunchMatch.split(' vs ').map((v) => v.trim());
  const left = getTeamData(leftName);
  const right = getTeamData(rightName);

  return (
    <div className="page">
      <div className="wrap">
        <div className="match-container">
          <div className="top-box">
            <div className="title-box">점심 경기</div>
            <div className="class-title-box">
              {left.name}
              <span>VS</span>
              {right.name}
            </div>
          </div>
          <div className="bottom-container">
            <div className="bottom-box">
              <div className="class-sub-box">
                {left.name}
                <span>VS</span>
                {right.name}
              </div>
              <div className="recent-box">
                <div className="recent-result-box">
                  {left.recent.map((r, i) => (
                    <span key={i} className={r === '패' ? 'active' : ''}>{r}</span>
                  ))}
                </div>
                최근 경기
                <div className="recent-result-box">
                  {right.recent.map((r, i) => (
                    <span key={i} className={r === '패' ? 'active' : ''}>{r}</span>
                  ))}
                </div>
              </div>
              <div className="rank-box">
                <div className="rank-info-box">
                  <span className="number">{left.rank}위</span>
                  <span className="label">순위</span>
                  <span className="number">{right.rank}위</span>
                </div>
              </div>
              <div className="today-match-info-box">
                <div className="today-info-box">
                  <span className="number">{left.win}</span>
                  <span className="label">승리</span>
                  <span className="number">{right.win}</span>
                </div>
              </div>
              <div className="today-match-info-box">
                <div className="today-info-box">
                  <span className="number">{left.lose}</span>
                  <span className="label">패배</span>
                  <span className="number">{right.lose}</span>
                </div>
              </div>
              <div className="today-match-info-box">
                <div className="today-info-box">
                  <span className="number">{left.point}</span>
                  <span className="label">승점</span>
                  <span className="number">{right.point}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
