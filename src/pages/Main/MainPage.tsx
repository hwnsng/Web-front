import '@/pages/Main/MainPage.css'
import mainImg from '@/media/main.png';
import { useNavigate } from 'react-router-dom';

export default function MainPage() {
    const navigate = useNavigate();
    return (
        <div className='container'>
            <div className='main'>
                <div className='main-container'>
                    <div className='main-content'>
                        <div className="text-section">
                            <p className="subtitle">2025 1학기 빅발리볼</p>
                            <h1 className="main-title">
                                <span className="highlight">2025 경소마고</span> 교내 리그전
                            </h1>
                            <div className="image-mobile">
                                <img src={mainImg} alt="공 사진" />
                            </div>

                            <div className="button-group">
                                <button className="main-button" onClick={() => { navigate('weekMatchPage') }}>경기 일정</button>
                                <button className="main-button" onClick={() => { navigate('/rankPage') }} >리그전 순위</button>
                            </div>
                        </div>
                        <div className='image-section'>
                            <img src={mainImg} alt="공 사진" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
