import '@/App.css';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainPage from './pages/Main/MainPage';
import WeekMatchPage from './pages/Week/WeekMatchPage';
import RankPage from './pages/Rank/RankPage';
import TodayMatchPage from './pages/Today/TodayMatchPage';
import LoginPage from './pages/Login/LoginPage';
import Header from './components/Header/Header';

export default function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/weekMatchPage" element={<WeekMatchPage />} />
        <Route path="/rankPage" element={<RankPage />} />
        <Route path="/loginPage" element={<LoginPage />} />
        <Route path="/todayMatchPage" element={<TodayMatchPage />} />
      </Routes>
    </Router>
  );
}