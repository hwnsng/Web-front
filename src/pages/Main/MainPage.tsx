import '@/pages/Main/MainPage.css';
import { Link } from 'react-router-dom';

export default function MainPage() {
  return (
    <main className="home-page">
      <div className="home-content">
        <p className="home-subtitle">1학기 빅발리볼 리그전</p>
        <h1 className="home-title"><span>2025학년도</span> 학교<br />스포츠 클럽 교내리그전</h1>
        <div className="home-actions">
          <Link className="home-button home-button-primary" to="/weekMatchPage">경기 일정 <span aria-hidden="true">↗</span></Link>
          <Link className="home-button" to="/rankPage">리그전 순위 <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </main>
  );
}
