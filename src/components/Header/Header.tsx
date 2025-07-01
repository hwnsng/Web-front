import '@/components/Header/Header.css';
import gbswLogo from '@/media/logo.png';
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="header">
      <div className="logo" onClick={() => { navigate('/') }}>
        <img src={gbswLogo} alt='경소마고 로고' />
        <h1>경북소프트웨어<br />마이스터고등학교</h1>
      </div>
      <div className="nav">
        <div className="nav-item">
          <Link to="/" className={location.pathname === "/" ? "active" : ""}>홈</Link>
        </div>
        <div className="nav-item">
          <Link to="/todayMatchPage" className={location.pathname === "/todayMatchPage" ? "active" : ""}>오늘 경기</Link>
        </div>
        <div className="nav-item">
          <Link to="/weekMatchPage" className={location.pathname === "/weekMatchPage" ? "active" : ""}>경기 일정</Link>
        </div>
        <div className="nav-item">
          <Link to="/rankPage" className={location.pathname === "/rankPage" ? "active" : ""}>순위</Link>
        </div>
        {/* <div className="nav-item">
          {<Link to="/loginPage" className={location.pathname === "/loginPage" ? "active" : ""}>로그인</Link>}
        </div> */}
      </div>
    </div>
  );
}