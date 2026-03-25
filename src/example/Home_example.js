import React, { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import PointStore from '../../../../point-web-main/src/PointStore';
import './Home_example.css';

const Home_example = () => {
    const [activeTab, setActiveTab] = useState('earn');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hoveredGrade, setHoveredGrade] = useState(null);

    // 포인트 상점 상태
    const [showStore, setShowStore] = useState(false);

    // 포인트 데이터 상태
    const [pointData, setPointData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [animatedValues, setAnimatedValues] = useState({
        points: 0
    });

    // 상품 데이터
    const products = [
        {
            id: 1,
            name: "스타벅스 아메리카노",
            description: "깔끔하고 진한 아메리카노",
            price: 100,
            stock: 15,
            image: "☕",
            category: "음료"
        },
        {
            id: 2,
            name: "아이패드 프로 케이스",
            description: "프리미엄 실리콘 케이스",
            price: 500,
            stock: 8,
            image: "📱",
            category: "액세서리"
        },
        {
            id: 3,
            name: "에어팟 프로",
            description: "노이즈 캔슬링 무선 이어폰",
            price: 2000,
            stock: 3,
            image: "🎧",
            category: "전자기기"
        },
        {
            id: 4,
            name: "애플 워치 밴드",
            description: "스포츠 루프 밴드",
            price: 300,
            stock: 12,
            image: "⌚",
            category: "액세서리"
        },
        {
            id: 5,
            name: "맥북 에어 슬리브",
            description: "프리미엄 가죽 슬리브",
            price: 800,
            stock: 5,
            image: "💼",
            category: "액세서리"
        },
        {
            id: 6,
            name: "아이폰 충전기",
            description: "20W USB-C 충전기",
            price: 150,
            stock: 20,
            image: "🔌",
            category: "전자기기"
        }
    ];

    // 포인트 상점 관련 핸들러
    const handlePurchase = (purchaseData) => {
        const { product, quantity, totalCost } = purchaseData;

        alert(`${product.name} ${quantity}개를 구매했습니다!`);

        setAnimatedValues(prev => ({
            ...prev,
            points: prev.points - totalCost
        }));

        setShowStore(false);
    };

    // 포인트 데이터 API 호출
    useEffect(() => {
        const fetchPointData = async () => {
            try {
                setLoading(true);
                const response = await fetch('http://localhost:8080/dash/point/csm6_mgr01');
                const result = await response.json();

                if (result.result && result.data) {
                    setPointData(result.data);
                } else {
                    setError(result.errorMessage || '데이터를 불러오는데 실패했습니다.');
                }
            } catch (err) {
                setError('서버 연결에 실패했습니다.');
                console.error('포인트 데이터 로드 에러:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchPointData();
    }, []);

    // 등급 시스템
    const gradeSystem = [
        { name: 'bronze', displayName: '브론즈', min: 0, max: 49, color: 'amber', icon: '🥉' },
        { name: 'silver', displayName: '실버', min: 50, max: 99, color: 'gray', icon: '🥈' },
        { name: 'gold', displayName: '골드', min: 100, max: 149, color: 'yellow', icon: '🥇' },
        { name: 'platinum', displayName: '플래티넘', min: 150, max: 999999, color: 'purple', icon: '💎' }
    ];

    const getCurrentGrade = (nudgeCount) => {
        return gradeSystem.find(grade => nudgeCount >= grade.min && nudgeCount <= grade.max);
    };

    const getNextGrade = (nudgeCount) => {
        return gradeSystem.find(grade => nudgeCount < grade.min);
    };

    // 등급별 혜택 정의
    const getGradeBenefits = (gradeName) => {
        const benefits = {
            bronze: [
                '• 기본 적립률 1% 적용',
                '• 월 1회 무료 음료 제공',
                '• 기본 상담 지원 서비스',
                '• 월간 성과 리포트 제공'
            ],
            silver: [
                '• 적립률 1.5% 적용 (50% 증가)',
                '• 월 2회 무료 음료 제공',
                '• 우선 상담 지원 서비스',
                '• 주간 성과 리포트 제공',
                '• 교육 자료 우선 접근'
            ],
            gold: [
                '• 적립률 2% 적용 (100% 증가)',
                '• 월 3회 무료 음료 제공',
                '• 전용 라운지 이용 가능',
                '• 특별 교육 프로그램 참여',
                '• 우선 배정 시스템 혜택',
                '• 분기별 성과 보너스'
            ],
            platinum: [
                '• 적립률 3% 적용 (200% 증가)',
                '• 무제한 음료 제공',
                '• VIP 라운지 무제한 이용',
                '• 1:1 전담 멘토링 서비스',
                '• 연말 특별 보너스 지급',
                '• 개인 비서 서비스 제공',
                '• 해외 연수 기회 우선권'
            ]
        };
        return benefits[gradeName] || [];
    };

    const convertPointHistory = (history) => {
        return history.map(item => ({
            ...item,
            emoji: item.pointType === 'EARN' ?
                (item.pointReason.includes('넛지') ? '🎉' :
                    item.pointReason.includes('만족도') ? '⭐' :
                        item.pointReason.includes('성과') ? '🎯' :
                            item.pointReason.includes('1위') ? '🏆' :
                                item.pointReason.includes('우수상담원') ? '🎖️' : '🎁') :
                (item.pointReason.includes('카페') ? '☕' :
                    item.pointReason.includes('편의점') ? '🛍️' :
                        item.pointReason.includes('점심') ? '🍔' :
                            item.pointReason.includes('문화') ? '🎁' : '🛍️'),
            displayDate: new Date(item.createdDate).toLocaleDateString('ko-KR', {
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, '.')
        }));
    };

    // 숫자 카운트업 애니메이션
    useEffect(() => {
        if (!pointData) return;

        const duration = 1500;
        const steps = 30;
        const stepTime = duration / steps;

        let currentStep = 0;
        const timer = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            const easeOut = 1 - Math.pow(1 - progress, 3);

            setAnimatedValues({
                points: Math.floor(easeOut * pointData.currentPoints)
            });

            if (currentStep >= steps) {
                clearInterval(timer);
                setAnimatedValues({
                    points: pointData.currentPoints
                });
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [pointData]);

    // ESC 키로 모달 닫기
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isModalOpen) {
                setIsModalOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isModalOpen]);

    // 포인트 데이터가 로드되기 전까지 로딩 처리
    if (loading) {
        return (
            <div className="dashboard">
                <div className="loading-container">
                    <div className="loading-spinner">🔄</div>
                    <div>포인트 데이터를 불러오는 중...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard">
                <div className="error-container">
                    <div className="error-message">❌ {error}</div>
                    <button onClick={() => window.location.reload()}>다시 시도</button>
                </div>
            </div>
        );
    }

    const currentGrade = pointData ? getCurrentGrade(pointData.monthNudgeCount) : gradeSystem[0];
    const nextGrade = pointData ? getNextGrade(pointData.monthNudgeCount) : null;
    const gradeProgress = pointData && nextGrade ?
        ((pointData.monthNudgeCount - currentGrade.min) / (nextGrade.min - currentGrade.min)) * 100 : 100;

    // 포인트 히스토리 데이터 변환
    const earnHistory = pointData ? convertPointHistory(pointData.pointHistory.filter(item => item.pointType === 'EARN')) : [];
    const spendHistory = pointData ? convertPointHistory(pointData.pointHistory.filter(item => item.pointType === 'SPEND')) : [];

    return (
        <div className="dashboard">
            <div className="dashboard-container">
                {/* 상단 네비게이션 */}
                <div className="top-navigation">
                    <div className="nav-left">
                        <div className="system-brand">
                            <div className="brand-icon">🤝</div>
                            <h1 className="brand-name">하이파이브 넛지</h1>
                        </div>
                    </div>
                    <div className="nav-right">
                        <div className="user-greeting">
                            <span className="greeting-text">안녕하세요, <strong>김상담님</strong> 👋</span>
                            <span className="greeting-subtitle">오늘도 좋은 하루 되세요!</span>
                        </div>
                    </div>
                </div>

                {/* 등급 시스템 & 포인트 */}
                <div className="points-section">
                    <div className="section-header">
                        <div className="title-group">
                            <div className="title-indicator amber"></div>
                            <h2>등급 시스템 & 포인트</h2>
                        </div>
                        <div className="points-badge">이번주 +{pointData ? earnHistory.slice(0, 3).reduce((sum, item) => sum + item.pointAmount, 0) : 0}P ✨</div>
                    </div>

                    <div className="points-cards">
                        <div className="integrated-points-grade-card">
                            <div className="points-grade-content">
                                {/* 포인트 정보 섹션 */}
                                <div className="points-section-content">
                                    <div className="current-points">{pointData ? animatedValues.points.toLocaleString() : '0'}</div>
                                    <div className="points-label">현재 보유 포인트</div>

                                    <div className="grade-progress">
                                        <div className="progress-bar">
                                            <div
                                                className={`progress-fill ${currentGrade.color}`}
                                                style={{ width: `${gradeProgress}%` }}
                                            ></div>
                                        </div>
                                        <div className="progress-label">
                                            {pointData && nextGrade ? `${nextGrade.displayName}까지 ${nextGrade.min - pointData.monthNudgeCount}건` : '최고 등급!'}
                                        </div>
                                    </div>

                                    <div className={`grade-badge ${currentGrade.color}`}>
                                        <span>{currentGrade.icon}</span>
                                        <span>{currentGrade.displayName} 등급</span>
                                    </div>

                                    <div className="team-rank-info">
                                        이달 넛지 건수: {pointData ? pointData.monthNudgeCount : 0}건
                                    </div>

                                    <button
                                        className="points-history-button-inline"
                                        onClick={() => setIsModalOpen(true)}
                                    >
                                        <div className="button-content-inline">
                                            <div className="button-icon">📊</div>
                                            <div className="button-text">
                                                <div className="button-title">포인트 내역 보기</div>
                                            </div>
                                            <div className="button-arrow">→</div>
                                        </div>
                                    </button>

                                    <button
                                        className="points-shop-button-inline"
                                        onClick={() => setShowStore(true)}
                                    >
                                        <div className="button-content-inline">
                                            <div className="button-icon">🛍️</div>
                                            <div className="button-text">
                                                <div className="button-title">포인트 상점</div>
                                            </div>
                                            <div className="button-arrow">→</div>
                                        </div>
                                    </button>
                                </div>

                                {/* 등급 시스템 섹션 */}
                                <div className="grade-system-content">
                                    <h3 className="grade-system-title">
                                        <Trophy className="icon" />
                                        <span>등급 시스템</span>
                                    </h3>

                                    <div className="grade-list">
                                        {gradeSystem.map((grade, index) => (
                                            <div
                                                key={grade.name}
                                                className={`grade-item ${grade.name === currentGrade.name ? 'active' : ''} ${grade.color}`}
                                                onMouseEnter={() => {
                                                    setHoveredGrade(grade.name);
                                                }}
                                                onMouseLeave={() => {
                                                    setHoveredGrade(null);
                                                }}
                                            >
                                                <div className="grade-info">
                                                    <span className="grade-icon">{grade.icon}</span>
                                                    <span className="grade-name">{grade.displayName}</span>
                                                    {grade.name === currentGrade.name && (
                                                        <span className="current-badge">현재</span>
                                                    )}
                                                </div>
                                                <span className="grade-points">
                                                    {grade.max === 999999 ? `${grade.min}건+` : `${grade.min}-${grade.max}건`}
                                                </span>

                                                {/* 호버 시 표시되는 혜택 툴팁 */}
                                                {hoveredGrade === grade.name && (
                                                    <div className={`grade-hover-benefits ${grade.color}`}>
                                                        <div className="benefits-header-tooltip">
                                                            <span>{grade.icon} {grade.displayName} 등급 혜택</span>
                                                        </div>
                                                        <div className="benefits-list-tooltip">
                                                            {getGradeBenefits(grade.name).map((benefit, idx) => (
                                                                <div key={idx} className="benefit-item">{benefit}</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* 현재 등급 혜택 */}
                                    <div className={`grade-benefits ${currentGrade.color}`}>
                                        <div className="benefits-header">
                                            <span>{currentGrade.icon} {currentGrade.displayName} 등급 혜택</span>
                                        </div>
                                        <div className="benefits-list">
                                            {currentGrade.name === 'bronze' && (
                                                <>
                                                    <div>• 기본 적립률 1%</div>
                                                    <div>• 월 1회 무료 음료</div>
                                                </>
                                            )}
                                            {currentGrade.name === 'silver' && (
                                                <>
                                                    <div>• 적립률 1.5%</div>
                                                    <div>• 월 2회 무료 음료</div>
                                                    <div>• 우선 상담 지원</div>
                                                </>
                                            )}
                                            {currentGrade.name === 'gold' && (
                                                <>
                                                    <div>• 적립률 2%</div>
                                                    <div>• 월 3회 무료 음료</div>
                                                    <div>• 전용 라운지 이용</div>
                                                    <div>• 특별 교육 프로그램</div>
                                                </>
                                            )}
                                            {currentGrade.name === 'platinum' && (
                                                <>
                                                    <div>• 적립률 3%</div>
                                                    <div>• 무제한 음료</div>
                                                    <div>• VIP 라운지 이용</div>
                                                    <div>• 1:1 멘토링</div>
                                                    <div>• 연말 특별 보너스</div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 포인트 내역 모달 */}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>포인트 내역</h3>
                            <button
                                className="modal-close"
                                onClick={() => setIsModalOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="tab-buttons">
                                <button
                                    onClick={() => setActiveTab('earn')}
                                    className={`tab-button ${activeTab === 'earn' ? 'active' : ''}`}
                                >
                                    적립 🎯
                                </button>
                                <button
                                    onClick={() => setActiveTab('use')}
                                    className={`tab-button ${activeTab === 'use' ? 'active' : ''}`}
                                >
                                    사용 🛍️
                                </button>
                            </div>

                            <div className="history-list">
                                {activeTab === 'earn' ? (
                                    earnHistory.length > 0 ? (
                                        earnHistory.map((item, index) => (
                                            <div key={index} className="history-item earn">
                                                <div className="item-info">
                                                    <div className="emoji">{item.emoji}</div>
                                                    <div>
                                                        <div className="item-title">{item.pointReason}</div>
                                                        <div className="item-date">{item.displayDate}</div>
                                                        {item.gradeBonusRate > 0 && (
                                                            <div className="bonus-info">
                                                                {item.grade} 등급 보너스 +{(item.gradeBonusRate * 100).toFixed(1)}%
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="item-points">+{item.pointAmount}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="no-history-message">
                                            <div className="no-history-icon">📊</div>
                                            <div className="no-history-text">적립 내역이 없습니다</div>
                                        </div>
                                    )
                                ) : (
                                    spendHistory.length > 0 ? (
                                        spendHistory.map((item, index) => (
                                            <div key={index} className="history-item use">
                                                <div className="item-info">
                                                    <div className="emoji">{item.emoji}</div>
                                                    <div>
                                                        <div className="item-title">{item.pointReason}</div>
                                                        <div className="item-date">{item.displayDate}</div>
                                                    </div>
                                                </div>
                                                <div className="item-points">-{Math.abs(item.pointAmount)}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="no-history-message">
                                            <div className="no-history-icon">🛍️</div>
                                            <div className="no-history-text">사용 내역이 없습니다</div>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 포인트 상점 컴포넌트 */}
            <PointStore
                isVisible={showStore}
                onClose={() => setShowStore(false)}
                userPoints={animatedValues.points}
                products={products}
                onPurchase={handlePurchase}
            />
        </div>
    );
};

export default Home_example;