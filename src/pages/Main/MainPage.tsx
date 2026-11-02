import '@/pages/Main/MainPage.css';
import { Link } from 'react-router-dom';

export default function MainPage() {
  return (
    <main className="home-page">
      <div className="home-content">
        <p className="home-subtitle">경북소프트웨어마이스터고등학교</p>
        <h1 className="home-title"><span>빅(BIG)챔스</span> 리그</h1>
        <p className="home-description">교내 스포츠 클럽 교내리그전</p>
        <div className="home-actions">
          <Link className="home-button home-button-primary" to="/weekMatchPage">경기 일정 <span aria-hidden="true">↗</span></Link>
          <Link className="home-button" to="/rankPage">리그전 순위 <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </main>
  );
}
