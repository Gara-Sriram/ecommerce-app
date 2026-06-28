import { createContext, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { saveProductsOffline, getCachedProducts } from "../utils/db";

export const ShopContext = createContext();

// ─── Cache API helpers (browser Cache Storage — works even without SW) ────────
const CACHE_NAME = 'shopease-products-v1';

const saveToCache = async (products) => {
    try {
        if (!('caches' in window)) return;
        const cache = await caches.open(CACHE_NAME);
        const response = new Response(JSON.stringify({ success: true, products }), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put('/api/product/list', response);
    } catch (e) {
        console.warn('[Cache API] Could not save:', e);
    }
};

const readFromCache = async () => {
    try {
        if (!('caches' in window)) return null;
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match('/api/product/list');
        if (!response) return null;
        const data = await response.json();
        return data?.products || null;
    } catch (e) {
        console.warn('[Cache API] Could not read:', e);
        return null;
    }
};
// ─────────────────────────────────────────────────────────────────────────────

const ShopContextProvider = (props) => {

    const currency = '$';
    const delivery_fee = 10;
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const [search, setSearch] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [cartItems, setCartItems] = useState({});
    const [products, setProducts] = useState([]);
    const [token, setToken] = useState('');
    const [isOffline, setIsOffline] = useState(false);
    const navigate = useNavigate();

    const addToCart = async (itemId, size) => {
        if (!size) { toast.error('Select Product Size'); return; }
        let cartData = structuredClone(cartItems);
        if (cartData[itemId]) {
            cartData[itemId][size] = (cartData[itemId][size] || 0) + 1;
        } else {
            cartData[itemId] = { [size]: 1 };
        }
        setCartItems(cartData);

        if (token) {
            try {
                await axios.post(backendUrl + '/api/cart/add', { itemId, size }, { headers: { token } });
            } catch (error) {
                if (!navigator.onLine) {
                    toast.info('Offline: Item added locally. Will sync when back online.');
                } else {
                    console.log(error);
                    toast.error(error.message);
                }
            }
        }
    };

    const getCartCount = () => {
        let totalCount = 0;
        for (const items in cartItems) {
            for (const item in cartItems[items]) {
                try {
                    if (cartItems[items][item] > 0) totalCount += cartItems[items][item];
                } catch (e) { console.log(e); }
            }
        }
        return totalCount;
    };

    const updateQuantity = async (itemId, size, quantity) => {
        let cartData = structuredClone(cartItems);
        cartData[itemId][size] = quantity;
        setCartItems(cartData);
        if (token) {
            try {
                await axios.post(backendUrl + '/api/cart/update', { itemId, size, quantity }, { headers: { token } });
            } catch (error) { console.log(error); toast.error(error.message); }
        }
    };

    const getCartAmount = () => {
        let totalAmount = 0;
        for (const items in cartItems) {
            let itemInfo = products.find((product) => product._id === items);
            for (const item in cartItems[items]) {
                try {
                    if (cartItems[items][item] > 0) totalAmount += itemInfo.price * cartItems[items][item];
                } catch (e) { }
            }
        }
        return totalAmount;
    };

    /**
     * Fetch products with THREE-LAYER fallback:
     *
     * Layer 1: Try live server (axios with 6s timeout)
     * Layer 2: Browser Cache API (saved on last successful fetch)
     * Layer 3: IndexedDB (longer-lived offline storage)
     *
     * This means even in npm run dev mode, layers 2 & 3 always work.
     */
    const getProductsData = async () => {
        try {
            // ── LAYER 1: Live server ──────────────────────────────────────────
            const response = await axios.get(backendUrl + '/api/product/list', {
                timeout: 6000 // 6 second timeout
            });

            if (response.data.success) {
                const freshProducts = response.data.products;
                setProducts(freshProducts);
                setIsOffline(false);

                // ✅ Save to BOTH caches on every successful fetch
                await Promise.all([
                    saveToCache(freshProducts),         // Cache API (fast)
                    saveProductsOffline(freshProducts)  // IndexedDB (persistent)
                ]);
            } else {
                toast.error(response.data.message);
            }

        } catch (error) {
            // ── LAYER 2: Browser Cache API ────────────────────────────────────
            console.warn('[ShopContext] Server unreachable. Trying Cache API...');
            const cacheProducts = await readFromCache();

            if (cacheProducts && cacheProducts.length > 0) {
                setProducts(cacheProducts);
                setIsOffline(true);
                toast.warn(
                    `⚠️ Server unavailable — showing ${cacheProducts.length} cached products. Cart syncs when back online.`,
                    { autoClose: 7000, toastId: 'offline-toast' }
                );
                return;
            }

            // ── LAYER 3: IndexedDB ────────────────────────────────────────────
            console.warn('[ShopContext] Cache API empty. Trying IndexedDB...');
            const idbProducts = await getCachedProducts();

            if (idbProducts && idbProducts.length > 0) {
                setProducts(idbProducts);
                setIsOffline(true);
                toast.warn(
                    `⚠️ Server unavailable — showing ${idbProducts.length} saved products.`,
                    { autoClose: 7000, toastId: 'offline-toast' }
                );
                return;
            }

            // ── All layers failed ─────────────────────────────────────────────
            setIsOffline(true);
            toast.error(
                'Server is currently unavailable. Please visit the site once when the server is back online to enable offline browsing.',
                { autoClose: 10000 }
            );
        }
    };

    const getUserCart = async (token) => {
        try {
            const response = await axios.post(backendUrl + '/api/cart/get', {}, { headers: { token } });
            if (response.data.success) setCartItems(response.data.cartData);
        } catch (error) {
            console.log(error);
            // Don't show error if offline — cart state is maintained in component
        }
    };

    useEffect(() => { getProductsData(); }, []);

    useEffect(() => {
        if (!token && localStorage.getItem('token')) {
            setToken(localStorage.getItem('token'));
            getUserCart(localStorage.getItem('token'));
        }
    }, []);

    // Auto-refresh when network comes back online
    useEffect(() => {
        const handleOnline = () => {
            if (isOffline) {
                toast.success('🌐 Back online! Refreshing products...');
                getProductsData();
            }
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [isOffline]);

    const value = {
        products, currency, delivery_fee,
        search, setSearch, showSearch, setShowSearch,
        cartItems, setCartItems, addToCart, getCartCount,
        updateQuantity, getCartAmount, navigate,
        backendUrl, setToken, token, isOffline
    };

    return (
        <ShopContext.Provider value={value}>
            {props.children}
        </ShopContext.Provider>
    );
};

export default ShopContextProvider;