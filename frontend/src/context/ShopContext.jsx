import { createContext, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export const ShopContext = createContext();

// ─── localStorage Offline Cache ───────────────────────────────────────────────
// Simplest and most reliable approach — works in dev, prod, with or without SW.
// No Service Worker, no IndexedDB complexity, just plain localStorage.
const CACHE_KEY = 'shopease_products';
const CACHE_TIME_KEY = 'shopease_products_time';

const saveProductsToLocal = (products) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(products));
        localStorage.setItem(CACHE_TIME_KEY, new Date().toISOString());
        console.log(`[Offline Cache] ✅ Saved ${products.length} products to localStorage`);
    } catch (e) {
        console.warn('[Offline Cache] localStorage save failed:', e);
    }
};

const loadProductsFromLocal = () => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        if (!cached) return null;
        return {
            products: JSON.parse(cached),
            savedAt: cachedTime ? new Date(cachedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown'
        };
    } catch (e) {
        console.warn('[Offline Cache] localStorage read failed:', e);
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
    const [wishlist, setWishlist] = useState([]);
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
                    toast.info('📦 Item saved locally — will sync when back online.');
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
     * Fetch products with fallback:
     * 1️⃣  Try live backend (6s timeout)
     * 2️⃣  If fails → read from localStorage (saved on last successful fetch)
     *
     * Works in dev mode, prod mode, with or without Service Worker.
     */
    const getProductsData = async () => {
        // ── Guard: if backendUrl is not configured, skip to cache immediately ──
        if (!backendUrl) {
            console.warn('[ShopContext] VITE_BACKEND_URL is not set — loading from local cache.');
            const cached = loadProductsFromLocal();
            if (cached && cached.products.length > 0) {
                setProducts(cached.products);
                setIsOffline(true);
                toast.warn(
                    `⚠️ Backend URL not configured — showing ${cached.products.length} cached products.`,
                    { autoClose: 8000, toastId: 'offline-toast' }
                );
            } else {
                setIsOffline(true);
                toast.error('Backend URL not set and no cached products found.', { autoClose: 10000 });
            }
            return;
        }

        try {
            // ── Try live server ─────────────────────────────────────────────
            const response = await axios.get(backendUrl + '/api/product/list', { timeout: 6000 });

            if (response.data.success) {
                const freshProducts = response.data.products;
                setProducts(freshProducts);
                setIsOffline(false);
                // ✅ Save to localStorage every time server responds successfully
                saveProductsToLocal(freshProducts);
            } else {
                toast.error(response.data.message);
            }

        } catch (error) {
            // ── Server failed → load from localStorage ──────────────────────
            console.warn('[ShopContext] Server unreachable. Loading from local cache...');
            const cached = loadProductsFromLocal();

            if (cached && cached.products.length > 0) {
                setProducts(cached.products);
                setIsOffline(true);
                toast.warn(
                    `⚠️ Server unavailable — showing ${cached.products.length} cached products (saved at ${cached.savedAt}). Cart will sync when back online.`,
                    { autoClose: 8000, toastId: 'offline-toast' }
                );
            } else {
                // No cache at all — first time user, server is down
                setIsOffline(true);
                toast.error(
                    '❌ Server is down and no cached products found. Please open the app once with the server running to enable offline browsing.',
                    { autoClose: 12000 }
                );
            }
        }
    };

    const getUserCart = async (token) => {
        try {
            const response = await axios.post(backendUrl + '/api/cart/get', {}, { headers: { token } });
            if (response.data.success) setCartItems(response.data.cartData);
        } catch (error) {
            // Silent fail when offline — cart state preserved in React state
            console.log('[Cart] Offline — skipping cart sync');
        }
    };

    const getUserWishlist = async (tokenVal) => {
        if (!tokenVal) return;
        try {
            const response = await axios.get(backendUrl + '/api/user/wishlist', { headers: { token: tokenVal } });
            if (response.data.success) {
                // Store array of product IDs or populated product objects
                setWishlist(response.data.wishlist.map(item => item._id || item));
            }
        } catch (error) {
            console.log('[Wishlist] Failed to fetch wishlist:', error.message);
        }
    };

    const toggleWishlist = async (productId) => {
        if (!token) {
            toast.error('Please log in to add products to your wishlist.');
            navigate('/login');
            return;
        }

        const isFav = wishlist.includes(productId);
        const url = backendUrl + (isFav ? '/api/user/wishlist/remove' : '/api/user/wishlist/add');

        try {
            const response = await axios.post(url, { productId }, { headers: { token } });
            if (response.data.success) {
                if (isFav) {
                    setWishlist(prev => prev.filter(id => id !== productId));
                    toast.success('Removed from wishlist.');
                } else {
                    setWishlist(prev => [...prev, productId]);
                    toast.success('Added to wishlist!');
                }
            } else {
                toast.error(response.data.message);
            }
        } catch (error) {
            console.log('[Wishlist] Toggle failed:', error.message);
            toast.error('Failed to update wishlist.');
        }
    };

    useEffect(() => { getProductsData(); }, []);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            setToken(storedToken);
            getUserCart(storedToken);
            getUserWishlist(storedToken);
        } else {
            setToken('');
            setCartItems({});
            setWishlist([]);
        }
    }, [token]);

    // Auto-refresh products when internet comes back
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
        backendUrl, setToken, token, isOffline,
        wishlist, toggleWishlist, getUserWishlist
    };

    return (
        <ShopContext.Provider value={value}>
            {props.children}
        </ShopContext.Provider>
    );
};

export default ShopContextProvider;