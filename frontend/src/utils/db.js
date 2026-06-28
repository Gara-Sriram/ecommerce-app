/**
 * IndexedDB helper using the 'idb' library
 * 
 * Purpose: Store product data locally in the browser so that when
 * the server is down, users can still browse previously cached products.
 * 
 * Think of it as a mini-database living inside the browser.
 */

import { openDB } from 'idb';

const DB_NAME = 'shopease-offline-db';
const DB_VERSION = 1;
const PRODUCTS_STORE = 'products';
const META_STORE = 'meta';

// Open (or create) the IndexedDB database
const getDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Products store — indexed by _id for fast lookups
            if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
                const store = db.createObjectStore(PRODUCTS_STORE, { keyPath: '_id' });
                store.createIndex('category', 'category', { unique: false });
                store.createIndex('bestseller', 'bestseller', { unique: false });
            }
            // Meta store — stores last-sync timestamp
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE);
            }
        }
    });
};

/**
 * Save all products to IndexedDB (called when server is reachable)
 */
export const saveProductsOffline = async (products) => {
    try {
        const db = await getDB();
        const tx = db.transaction(PRODUCTS_STORE, 'readwrite');
        // Clear old data and write fresh
        await tx.store.clear();
        for (const product of products) {
            await tx.store.put(product);
        }
        await tx.done;

        // Save last-sync timestamp
        const metaTx = db.transaction(META_STORE, 'readwrite');
        await metaTx.store.put(new Date().toISOString(), 'lastSync');
        await metaTx.done;

        console.log(`[Offline DB] Saved ${products.length} products at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.warn('[Offline DB] Failed to save products:', error);
    }
};

/**
 * Get all cached products from IndexedDB (used when server is down)
 */
export const getCachedProducts = async () => {
    try {
        const db = await getDB();
        const products = await db.getAll(PRODUCTS_STORE);
        return products;
    } catch (error) {
        console.warn('[Offline DB] Failed to read cached products:', error);
        return [];
    }
};

/**
 * Get last sync time — shown in the offline banner
 */
export const getLastSyncTime = async () => {
    try {
        const db = await getDB();
        return await db.get(META_STORE, 'lastSync');
    } catch {
        return null;
    }
};

/**
 * Check how many products are in the cache
 */
export const getCachedProductCount = async () => {
    try {
        const db = await getDB();
        return await db.count(PRODUCTS_STORE);
    } catch {
        return 0;
    }
};
