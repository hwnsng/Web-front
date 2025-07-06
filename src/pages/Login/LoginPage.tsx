import { useState } from 'react';
import './LoginPage.css';
import LoginImg from '@/media/main.png';
import gbswLogo from '@/media/logo.png';

export default function LoginPage() {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.reload();
  };

  return (
    <div className="login-page-container">
      <div className="login-left">
        <img src={LoginImg} alt="로그인 이미지" className="login-img" />
      </div>
      <div className="login-right">
        <div className="login-box">
          <div className="login-in-box">
            <div className="login-logo">
              <img src={gbswLogo} alt='경소마고 로고' />
              <h1>경북소프트웨어<br />마이스터고등학교</h1>
            </div>
            <h2 className="login-title">로그인</h2>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="아이디"
                  onFocus={() => setFocusedField('id')}
                  onBlur={() => setFocusedField(null)}
                  className={`login-input ${focusedField === 'id' ? 'focused' : ''}`}
                />
                <div className={`underline ${focusedField === 'id' ? 'active' : ''}`} />
              </div>

              <div className="input-group" style={{ margin: "0" }}>
                <input
                  type="password"
                  placeholder="비밀번호"
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className={`login-input ${focusedField === 'password' ? 'focused' : ''}`}
                />
                <div className={`underline ${focusedField === 'password' ? 'active' : ''}`} />
              </div>

              <button className="login-button" type="submit">로그인</button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
