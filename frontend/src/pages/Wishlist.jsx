import React, { useContext, useEffect, useState } from 'react';
import { ShopContext } from '../context/ShopContext';
import Title from '../components/Title';
import ProductItem from '../components/ProductItem';

/**
 * Wishlist Page
 *
 * Displays all products that the user has added to their wishlist.
 * Allows quick removal and clicking through to product details.
 */
const Wishlist = () => {
    const { wishlist, products, toggleWishlist, token, navigate } = useContext(ShopContext);
    const [wishlistItems, setWishlistItems] = useState([]);

    // Filter products that are in the user's wishlist
    useEffect(() => {
        const filtered = products.filter(product => wishlist.includes(product._id));
        setWishlistItems(filtered);
    }, [wishlist, products]);

    if (!token) {
        return (
            <div className="border-t pt-14 text-center my-20">
                <Title text1="YOUR" text2="WISHLIST" />
                <p className="text-gray-500 mt-6 text-sm">Please log in to view your wishlist.</p>
                <button
                    onClick={() => navigate('/login')}
                    className="bg-black text-white px-8 py-3 text-sm mt-6 font-medium tracking-wide active:scale-95 transition-all"
                >
                    LOG IN
                </button>
            </div>
        );
    }

    return (
        <div className="border-t pt-14">
            <div className="text-2xl mb-3">
                <Title text1="YOUR" text2="WISHLIST" />
            </div>

            {wishlistItems.length === 0 ? (
                <div className="text-center my-20">
                    <p className="text-gray-500 text-sm">Your wishlist is empty.</p>
                    <button
                        onClick={() => navigate('/collection')}
                        className="border border-black text-black hover:bg-black hover:text-white px-8 py-3 text-sm mt-6 font-medium tracking-wide transition-all duration-200 active:scale-95"
                    >
                        EXPLORE PRODUCTS
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6">
                    {wishlistItems.map((item) => (
                        <div key={item._id} className="relative group">
                            {/* Product Item Wrapper */}
                            <ProductItem
                                id={item._id}
                                name={item.name}
                                image={item.image}
                                price={item.price}
                            />

                            {/* Remove button (Heart Icon) */}
                            <button
                                type="button"
                                onClick={() => toggleWishlist(item._id)}
                                className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-50 active:scale-90 transition-all border border-gray-100 flex items-center justify-center"
                                title="Remove from Wishlist"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    className="w-4 h-4 fill-red-500 stroke-red-500"
                                    strokeWidth="2"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Wishlist;
