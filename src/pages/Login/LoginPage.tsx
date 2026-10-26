import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useLeague } from '../../league';
import './LoginPage.css';
import logo from '@/media/logo.png';
export default function LoginPage() {
  const { data, refresh } = useLeague();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('/login', 'POST', { username, password }); await refresh(); setPassword(''); }
    catch { setError('정보가 잘못되었습니다.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try { await api('/logout', 'POST'); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="login-page-container">
    <div className="login-right"><div className="login-box"><div className="login-in-box">
      <div className="login-logo"><img src={logo} alt="학교 로고" /><h1>경소마고 스포츠 클럽</h1></div>
      <h2 className="login-title">{data?.admin ? '관리자 로그인됨' : '관리자 로그인'}</h2>
      {data?.admin ? <><p><Link to="/weekMatchPage">경기 일정 관리</Link></p><button className="login-button" disabled={busy} onClick={() => void logout()}>로그아웃</button></> :
        <form onSubmit={submit}>
          <label htmlFor="username">아이디</label><div className="input-group"><input id="username" className="login-input" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} /></div>
          <label htmlFor="password">비밀번호</label>
          <div className="input-group password-input-group">
            <input id="password" className="login-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
            <button type="button" className="password-visibility-toggle" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'} aria-controls="password" title={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'} onClick={() => setShowPassword(value => !value)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {showPassword ? <>
                  <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.6 10.6 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3.1 3.8M6.3 6.3A20 20 0 0 0 2 12s4 7 10 7a10.5 10.5 0 0 0 5.7-1.7" />
                </> : <>
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </>}
              </svg>
            </button>
          </div>
          <button className="login-button" disabled={busy} type="submit">{busy ? '로그인 중…' : '로그인'}</button>
          <p className="login-notice">로그인은 관리자만 가능합니다.</p>
        </form>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div></div></div>
  </div>;
}
