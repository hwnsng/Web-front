import { JSX, useState } from 'react';
import '@/pages/Rank/RankPage.css';
import { TeamInfo } from '../../mock/data.ts';
import firstImage from '@/media/first.png';
import secondImage from '@/media/second.png';
import thirdImage from '@/media/third.png';

interface Team {
    name: string;
    total: number;
    win: number;
    lose: number;
    point: number;
    winScore: number;
    loseScore: number;
}

export default function RankPage(): JSX.Element {
    function getCurrentFormattedDate(): string {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const hours = today.getHours();
        const period = hours < 12 ? '오전' : '오후';
        return `${month}.${day} ${period} 기준`;
    }

    const todayInfo = getCurrentFormattedDate();

    const [teams] = useState<Team[]>(TeamInfo);

    const getGoalDifference = (team: Team) => team.winScore - team.loseScore;

    const sortedTeams = [...teams].sort((a, b) => {
        if (b.point !== a.point) {
            return b.point - a.point;
        }
        return getGoalDifference(b) - getGoalDifference(a);
    });

    const getRankingsWithTies = (sortedTeams: Team[]) => {
        const rankings: { team: Team; rank: number }[] = [];
        let currentRank = 1;

        for (let i = 0; i < sortedTeams.length; i++) {
            if (i > 0) {
                const prevTeam = sortedTeams[i - 1];
                const currTeam = sortedTeams[i];

                const prevDiff = getGoalDifference(sortedTeams[i - 1]);
                const currDiff = getGoalDifference(sortedTeams[i]);

                const prevPoint = prevTeam.point;
                const currPoint = currTeam.point;

                if (!(prevPoint === currPoint && prevDiff === currDiff)) {
                    currentRank = i + 1;
                }
            }
            rankings.push({ team: sortedTeams[i], rank: currentRank });
        }

        return rankings;
    };

    const getRankImage = (rank: number): string => {
        if (rank === 1) return firstImage;
        if (rank === 2) return secondImage;
        if (rank === 3) return thirdImage;
        return '';
    };

    const renderTeamRow = (team: Team, rank: number) => {
        const rankImage = getRankImage(rank);

        return (
            <tr key={team.name} className="team-row">
                <td className="rank-num">{rank}</td>
                <td className="rank-image" style={{ padding: "15px 0px" }}>
                    {rankImage && <img src={rankImage} alt={`${rank}등`} className="rank-image-img" />}
                </td>
                <td className="team-name" style={{ textAlign: "left" }}>{team.name}</td>
                <td className="total">{team.total}</td>
                <td className="rev-total">{11 - team.total}</td>
                <td className="win">{team.win}</td>
                <td className="lose">{team.lose}</td>
                <td className="winScore">{team.winScore}</td>
            </tr>
        );
    };

    const rankedTeams = getRankingsWithTies(sortedTeams);


    return (
        <div className="rank-container">
            <div className="page-title-box">
                <h1 className="page-title"><span>실시간</span> 리그전 순위</h1>
            </div>

            <div className="tables-container">
                <table className="rank-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th></th>
                            <th></th>
                            <th>경기수</th>
                            <th>남은 경기</th>
                            <th>승리</th>
                            <th>패배</th>
                            <th>승점</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rankedTeams.map(({ team, rank }) => renderTeamRow(team, rank))}
                    </tbody>
                </table>
            </div>

            <div className="date-info">{todayInfo}</div>
        </div>
    );
}