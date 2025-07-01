import { useState, useEffect } from 'react';
import '@/pages/Week/WeekMatchPage.css';

type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

type MatchSchedule = {
    lunch: string;
};

type WeeklyMatches = Record<Weekday, MatchSchedule>;

export default function WeekMatchPage() {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [weeklyMatches] = useState<WeeklyMatches>({
        Monday: { lunch: '2-4 vs 1-4' },
        Tuesday: { lunch: '3-2 vs 1-1' },
        Wednesday: { lunch: '3-1 vs 1-4' },
        Thursday: { lunch: '2-3 vs 1-3' },
        Friday: { lunch: '3-3 vs 1-1' },
    });

    const today = new Date();
    const weekInfo = getCurrentMonthAndWeek();

    function getCurrentMonthAndWeek(): string {
        const month = today.getMonth() + 1;
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const offset = firstDayOfMonth.getDay();
        const weekNumber = Math.ceil((today.getDate() + offset) / 7);
        return `${month}월 ${weekNumber}째주`;
    }

    function renderMatch(match: string | null) {
        if (!match) return '-';
        const [teamA, teamB] = match.split(' vs ');
        return (
            <>
                {teamA} <span style={{ padding: '0px 5px', color: '#48A988', fontSize: isMobile ? '14px' : '20px' }}>vs</span> {teamB}
            </>
        );
    }

    type WeekDate = {
        eng: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
        kor: string;
        date: string;
    };

    function getWeekDates2(): WeekDate[] {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

        const engDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
        const korDays = ['월', '화', '수', '목', '금'];

        const result: WeekDate[] = [];

        for (let i = 0; i < 5; i++) {
            const current = new Date(monday);
            current.setDate(monday.getDate() + i);
            const month = current.getMonth() + 1;
            const date = current.getDate();

            result.push({
                eng: engDays[i],
                kor: korDays[i],
                date: `${month}/${date}`,
            });
        }

        return result;
    }

    return (
        <div className="week-match-container">
            <h1 className="week-title">
                <span>빅발리볼</span>일정표
            </h1>

            <div className="week-info">
                <p>{weekInfo}</p>
                <p>6라운드 / 7라운드</p>
            </div>

            <table className="match-table">
                <thead>
                    <tr>
                        {!isMobile && (
                            getWeekDates2().map(({ date, kor }, index) => (
                                <th key={index}>{`${date} (${kor})`}</th>
                            ))
                        )}
                    </tr>
                </thead>
                <tbody>
                    {!isMobile ? (
                        <tr className="lunch-match">
                            {getWeekDates2().map(({ eng }, idx) => (
                                <td key={idx}>{renderMatch(weeklyMatches[eng].lunch)}</td>
                            ))}
                        </tr>
                    ) : (
                        getWeekDates2().map(({ eng, kor, date }) => (
                            <tr key={eng} className={`mobile-row ${eng === 'Friday' ? 'friday-row' : ''}`}>
                                <td className="day-cell">
                                    <div>
                                        {date} <br />
                                        <span style={{ fontSize: "16px", color: "white" }}>{kor}</span>
                                    </div>
                                </td>
                                <td className={`lunch-cell ${eng === 'Friday' ? 'friday-lunch' : ''}`}>
                                    {renderMatch(weeklyMatches[eng].lunch)}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}