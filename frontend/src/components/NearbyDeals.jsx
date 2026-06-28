import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { ShopContext } from '../context/ShopContext';
import { toast } from 'react-toastify';

/**
 * NearbyDeals — Shows returned products listed for resale near the user's location.
 * Uses browser Geolocation API to find nearby listings via MongoDB $near query.
 */
const NearbyDeals = () => {
    const { backendUrl, currency, token, navigate } = useContext(ShopContext);
    const [deals, setDeals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locationStatus, setLocationStatus] = useState('requesting'); // 'requesting' | 'granted' | 'denied' | 'none'
    const [purchasing, setPurchasing] = useState(null); // returnId being purchased

    useEffect(() => {
        fetchNearbyDeals();
    }, []);

    const fetchNearbyDeals = () => {
        setLoading(true);

        // Try to get user's geolocation for nearby results
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    setLocationStatus('granted');
                    const { latitude, longitude } = position.coords;
                    try {
                        const res = await axios.get(
                            `${backendUrl}/api/returns/nearby?lat=${latitude}&lng=${longitude}&radius=75000`
                        );
                        if (res.data.success) {
                            setDeals(res.data.listings);
                        }
                    } catch (e) {
                        console.warn('Failed to fetch nearby deals', e);
                    }
                    setLoading(false);
                },
                async () => {
                    // Location denied — show all listings as fallback
                    setLocationStatus('denied');
                    try {
                        const res = await axios.get(`${backendUrl}/api/returns/nearby`);
                        if (res.data.success) setDeals(res.data.listings);
                    } catch (e) { }
                    setLoading(false);
                },
                { timeout: 5000 }
            );
        } else {
            // Geolocation not supported
            setLocationStatus('none');
            setLoading(false);
        }
    };

    const handleBuy = async (deal) => {
        if (!token) {
            toast.info('Please login to purchase this item.');
            navigate('/login');
            return;
        }
        setPurchasing(deal._id);
        try {
            const res = await axios.post(
                `${backendUrl}/api/returns/purchase`,
                { returnId: deal._id },
                { headers: { token } }
            );
            if (res.data.success) {
                toast.success(res.data.message);
                setDeals(prev => prev.filter(d => d._id !== deal._id));
            } else {
                toast.error(res.data.message);
            }
        } catch (e) {
            toast.error('Purchase failed. Please try again.');
        }
        setPurchasing(null);
    };

    const conditionColor = {
        'Like New': { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
        'Good': { bg: '#fffbeb', text: '#d97706', border: '#fcd34d' },
        'Acceptable': { bg: '#fff7ed', text: '#ea580c', border: '#fdba74' },
    };

    if (loading) {
        return (
            <div style={{ padding: '40px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div style={{ height: '28px', width: '220px', background: '#f3f4f6', borderRadius: '8px', animation: 'shimmer 1.5s infinite' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                            <div style={{ height: '200px', background: '#f3f4f6', animation: 'shimmer 1.5s infinite' }} />
                            <div style={{ padding: '16px' }}>
                                <div style={{ height: '16px', background: '#f3f4f6', borderRadius: '4px', marginBottom: '8px', animation: 'shimmer 1.5s infinite' }} />
                                <div style={{ height: '12px', width: '60%', background: '#f3f4f6', borderRadius: '4px', animation: 'shimmer 1.5s infinite' }} />
                            </div>
                        </div>
                    ))}
                </div>
                <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
            </div>
        );
    }

    if (deals.length === 0) return null; // Don't render section if no nearby deals

    return (
        <div style={{ padding: '48px 0' }}>
            {/* Section Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '28px' }}>🏷️</span>
                        <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: '#1a1a2e', letterSpacing: '-0.5px' }}>
                            Open Box Deals
                            <span style={{
                                marginLeft: '10px', background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                color: 'white', fontSize: '12px', padding: '3px 10px',
                                borderRadius: '20px', fontWeight: '600', verticalAlign: 'middle'
                            }}>
                                NEAR YOU
                            </span>
                        </h2>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                        {locationStatus === 'granted'
                            ? `Returned items from buyers within 75km — discounted & verified`
                            : 'Returned items listed by other buyers — discounted & verified'}
                    </p>
                </div>
                <button
                    onClick={fetchNearbyDeals}
                    style={{
                        background: 'transparent', border: '1.5px solid #d1d5db',
                        padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
                        color: '#6b7280', cursor: 'pointer', fontWeight: '500'
                    }}
                >
                    🔄 Refresh
                </button>
            </div>

            {/* Deals Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: '20px'
            }}>
                {deals.map((deal) => {
                    const cond = conditionColor[deal.condition] || conditionColor['Good'];
                    const isBuying = purchasing === deal._id;

                    return (
                        <div key={deal._id} style={{
                            background: 'white',
                            borderRadius: '16px',
                            border: '1px solid #e5e7eb',
                            overflow: 'hidden',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            cursor: 'default',
                            position: 'relative'
                        }}
                            onMouseOver={e => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.12)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {/* Discount badge */}
                            <div style={{
                                position: 'absolute', top: '12px', left: '12px',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                color: 'white', padding: '4px 10px', borderRadius: '20px',
                                fontSize: '12px', fontWeight: '700', zIndex: 1,
                                boxShadow: '0 2px 8px rgba(239,68,68,0.4)'
                            }}>
                                {deal.discountPercent}% OFF
                            </div>

                            {/* Product Image */}
                            <div style={{ position: 'relative', overflow: 'hidden', height: '210px' }}>
                                <img
                                    src={deal.productImage}
                                    alt={deal.productName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                                />
                            </div>

                            {/* Details */}
                            <div style={{ padding: '16px' }}>
                                <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '600', color: '#1f2937', lineHeight: '1.4' }}>
                                    {deal.productName}
                                </p>

                                {/* Condition tag */}
                                <span style={{
                                    display: 'inline-block', marginBottom: '10px',
                                    background: cond.bg, color: cond.text,
                                    border: `1px solid ${cond.border}`,
                                    padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600'
                                }}>
                                    {deal.condition}
                                </span>

                                {/* Price */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>
                                        {currency}{deal.resalePrice}
                                    </span>
                                    <span style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'line-through' }}>
                                        {currency}{deal.originalPrice}
                                    </span>
                                </div>

                                {/* Location */}
                                <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#9ca3af' }}>
                                    📍 {deal.locationLabel}
                                </p>

                                {/* Buy button */}
                                <button
                                    onClick={() => handleBuy(deal)}
                                    disabled={isBuying}
                                    style={{
                                        width: '100%', padding: '11px',
                                        background: isBuying
                                            ? '#9ca3af'
                                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white', border: 'none', borderRadius: '10px',
                                        fontSize: '14px', fontWeight: '600',
                                        cursor: isBuying ? 'not-allowed' : 'pointer',
                                        transition: 'opacity 0.2s'
                                    }}
                                    onMouseOver={e => { if (!isBuying) e.target.style.opacity = '0.88'; }}
                                    onMouseOut={e => { e.target.style.opacity = '1'; }}
                                >
                                    {isBuying ? 'Processing...' : `Buy for ${currency}${deal.resalePrice}`}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default NearbyDeals;
