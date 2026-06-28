import { useEffect, useState, useContext } from 'react';
import { ShopContext } from '../context/ShopContext';

/**
 * OfflineBanner — shown when:
 * 1. navigator.onLine is false (no internet), OR
 * 2. ShopContext's isOffline is true (server unreachable even with internet)
 *
 * This means it correctly shows when:
 * - Internet is gone
 * - Backend URL is wrong/removed
 * - Backend server is stopped
 * - Backend is down/crashed
 */
const OfflineBanner = () => {
    const { isOffline } = useContext(ShopContext);
    const [networkOffline, setNetworkOffline] = useState(!navigator.onLine);
    const [isVisible, setIsVisible] = useState(true);
    const [cachedCount, setCachedCount] = useState(0);
    const [lastSync, setLastSync] = useState(null);

    // Track browser network status separately
    useEffect(() => {
        const goOnline = () => setNetworkOffline(false);
        const goOffline = () => setNetworkOffline(true);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    // Read cache metadata from localStorage
    useEffect(() => {
        if (isOffline || networkOffline) {
            setIsVisible(true);
            try {
                const cached = localStorage.getItem('shopease_products');
                const cachedTime = localStorage.getItem('shopease_products_time');
                if (cached) setCachedCount(JSON.parse(cached).length);
                if (cachedTime) {
                    setLastSync(new Date(cachedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                }
            } catch (e) { /* silent */ }
        }
    }, [isOffline, networkOffline]);

    // Show banner if either: server down (isOffline) or no internet (networkOffline)
    const shouldShow = (isOffline || networkOffline) && isVisible;
    if (!shouldShow) return null;

    const reason = networkOffline
        ? 'No internet connection'
        : 'Server temporarily unavailable';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Pulsing amber dot */}
                <span style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: '#f59e0b', display: 'inline-block',
                    animation: 'offlinePulse 1.5s infinite',
                    boxShadow: '0 0 8px #f59e0b',
                    flexShrink: 0
                }} />
                <span>
                    <strong>⚠️ {reason}</strong>
                    {cachedCount > 0
                        ? ` — Browsing ${cachedCount} cached products (saved at ${lastSync})`
                        : ' — No cached products yet. Visit once with server running to enable offline mode.'}
                </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {cachedCount > 0 && (
                    <span style={{
                        background: 'rgba(245,158,11,0.2)',
                        border: '1px solid rgba(245,158,11,0.5)',
                        borderRadius: '20px', padding: '3px 12px',
                        fontSize: '12px', color: '#fcd34d', whiteSpace: 'nowrap'
                    }}>
                        🛒 Cart syncs when back online
                    </span>
                )}
                <button
                    onClick={() => setIsVisible(false)}
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.3)',
                        color: '#fff', cursor: 'pointer',
                        padding: '3px 10px', borderRadius: '4px',
                        fontSize: '12px', whiteSpace: 'nowrap'
                    }}
                >
                    Dismiss
                </button>
            </div>

            <style>{`
                @keyframes offlinePulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(1.4); }
                }
            `}</style>
        </div>
    );
};

export default OfflineBanner;
