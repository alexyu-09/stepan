import { useState, useEffect } from 'react';
import { Lock, LogIn, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface AuthProps {
    onAuthenticated: () => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthenticated }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial check for existing session
    useEffect(() => {
        const token = localStorage.getItem('stepan_auth_token');
        if (token) {
            onAuthenticated();
        }
    }, [onAuthenticated]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || loading) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Неверный пароль');
            }

            const { token } = await response.json();
            localStorage.setItem('stepan_auth_token', token);
            onAuthenticated();
        } catch (err: any) {
            setError(err.message || 'Ошибка сервера. Попробуйте снова.');
            setPassword('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #1a1c23 0%, #0a0b0e 100%)',
            padding: '1.5rem',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Background elements */}
            <div style={{
                position: 'fixed',
                top: '20%',
                left: '15%',
                width: '300px',
                height: '300px',
                background: 'rgba(81, 90, 218, 0.15)',
                filter: 'blur(100px)',
                borderRadius: '50%',
                zIndex: 0
            }} />
            <div style={{
                position: 'fixed',
                bottom: '15%',
                right: '10%',
                width: '250px',
                height: '250px',
                background: 'rgba(124, 58, 237, 0.1)',
                filter: 'blur(80px)',
                borderRadius: '50%',
                zIndex: 0
            }} />

            <div className="card fade-in" style={{
                maxWidth: '400px',
                width: '100%',
                padding: '2.5rem',
                textAlign: 'center',
                background: 'rgba(23, 25, 30, 0.6)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                zIndex: 1
            }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    boxShadow: '0 8px 16px rgba(81, 90, 218, 0.3)'
                }}>
                    <Lock size={30} color="#fff" />
                </div>

                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    marginBottom: '0.5rem',
                    background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.7))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>СТЕПАН: ВХОД</h1>
                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    marginBottom: '2rem'
                }}>Система управления прайс-листами</p>

                <form onSubmit={handleLogin}>
                    <div className="input-group" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="password"
                                className="input-field"
                                placeholder="Введите секретный пароль"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                                style={{
                                    paddingLeft: '2.75rem',
                                    height: '50px',
                                    fontSize: '1rem',
                                    background: 'rgba(0,0,0,0.3)',
                                    marginBottom: error ? '1rem' : '0'
                                }}
                            />
                            <ShieldCheck
                                size={18}
                                style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '16px',
                                    color: 'var(--primary)',
                                    opacity: 0.8
                                }}
                            />
                        </div>

                        {error && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: 'var(--error)',
                                fontSize: '0.85rem',
                                padding: '0.5rem 0.25rem',
                                borderRadius: '6px',
                                animation: 'shake 0.4s ease-in-out'
                            }}>
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || !password}
                        style={{
                            width: '100%',
                            height: '50px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            letterSpacing: '0.025em',
                            boxShadow: '0 4px 12px rgba(81, 90, 218, 0.4)'
                        }}
                    >
                        {loading ? <RefreshCw size={20} className="spin-icon" /> : <LogIn size={20} />}
                        {loading ? 'ПРОВЕРКА...' : 'ВОЙТИ В СИСТЕМУ'}
                    </button>
                </form>

                <div style={{
                    marginTop: '2rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    opacity: 0.6
                }}>
                    Защищено Secure Cloud Auth • v1.2
                </div>
            </div>

            <style>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
            `}</style>
        </div>
    );
};

export default Auth;
