import { useEffect, useState } from 'react';

/**
 * OfflineBanner — shown at the top of the page when the server is unreachable.
 * Reads cached product count + last save time from localStorage.
 * Auto-hides when connection is restored.
 */
const OfflineBanner = () => {
    const [isOffline, setIsOffline] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [cachedCount, setCachedCount] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        setIsOffline(!navigator.onLine);
        window.addEventListener('online', () => setIsOffline(false));
        window.addEventListener('offline', () => setIsOffline(true));
        return () => {
            window.removeEventListener('online', () => setIsOffline(false));
            window.removeEventListener('offline', () => setIsOffline(true));
        };
    }, []);

    useEffect(() => {
        if (isOffline) {
            setIsVisible(true);
            // Read from localStorage — the same place ShopContext saves to
            try {
                const cached = localStorage.getItem('shopease_products');
                const cachedTime = localStorage.getItem('shopease_products_time');
                if (cached) {
                    const products = JSON.parse(cached);
                    setCachedCount(products.length);
                }
                if (cachedTime) {
                    setLastSync(new Date(cachedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                }
            } catch (e) {
                console.warn('Could not read offline cache info');
            }
        }
    }, [isOffline]);

    if (!isOffline || !isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0,
            zIndex: 9999,
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            color: '#fff',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
            fontSize: '14px',
            gap: '12px',
            flexWrap: 'wrap'
        }}>
            {/* Left — status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: '#f59e0b', display: 'inline-block',
                    animation: 'pulse 1.5s infinite',
                    boxShadow: '0 0 8px #f59e0b'
                }} />
                <span>
                    <strong>Server temporarily unavailable</strong>
                    {cachedCount > 0
                        ? ` — Browsing ${cachedCount} cached products (saved at ${lastSync})`
                        : ' — Visit once with server running to enable offline mode'}
                </span>
            </div>

            {/* Right — cart note + dismiss */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {cachedCount > 0 && (
                    <span style={{
                        background: 'rgba(245,158,11,0.2)',
                        border: '1px solid rgba(245,158,11,0.5)',
                        borderRadius: '20px', padding: '3px 12px',
                        fontSize: '12px', color: '#fcd34d'
                    }}>
                        🛒 Cart syncs automatically when back online
                    </span>
                )}
                <button onClick={() => setIsVisible(false)} style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#fff', cursor: 'pointer',
                    padding: '3px 10px', borderRadius: '4px', fontSize: '12px'
                }}>
                    Dismiss
                </button>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.3); }
                }
            `}</style>
        </div>
    );
};

export default OfflineBanner;
