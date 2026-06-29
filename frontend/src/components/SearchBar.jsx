import React, { useState, useContext, useEffect, useRef } from 'react';
import { ShopContext } from '../context/ShopContext';
import { assets } from '../assets/assets';
import { useLocation } from 'react-router-dom';

/**
 * Premium SearchBar with Autocomplete Dropdown
 *
 * Features:
 *  - Works on all pages.
 *  - Dynamically filters suggestions as user types (min 2 characters).
 *  - Displays matching product thumbnails, names, and prices.
 *  - Click suggestion to navigate directly to product page.
 *  - Close dropdown when clicking outside.
 *  - Enter key triggers full search on the Collection page.
 */
const SearchBar = () => {
    const { search, setSearch, showSearch, setShowSearch, products, currency, navigate } = useContext(ShopContext);
    const [suggestions, setSuggestions] = useState([]);
    const dropdownRef = useRef(null);
    const location = useLocation();

    // Reset search input and suggestions when closing or navigating
    useEffect(() => {
        setSuggestions([]);
    }, [location, showSearch]);

    // Handle typing and generate suggestions
    useEffect(() => {
        if (search.trim().length >= 2) {
            const query = search.toLowerCase();
            const filtered = products.filter(item => 
                item.name.toLowerCase().includes(query) || 
                item.category.toLowerCase().includes(query) ||
                (item.subCategory && item.subCategory.toLowerCase().includes(query))
            ).slice(0, 6); // Max 6 autocomplete suggestions
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    }, [search, products]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setSuggestions([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setSuggestions([]);
        if (location.pathname !== '/collection') {
            navigate('/collection');
        }
    };

    const handleSuggestionClick = (productId) => {
        setSuggestions([]);
        setSearch('');
        setShowSearch(false);
        navigate(`/product/${productId}`);
    };

    return showSearch ? (
        <div ref={dropdownRef} className="border-t border-b bg-gray-50 text-center relative z-50">
            <form onSubmit={handleSearchSubmit} className="inline-flex items-center justify-center border border-gray-400 px-5 py-2 my-5 mx-3 rounded-full w-3/4 sm:w-1/2 relative bg-white">
                <input 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    className="flex-1 outline-none text-sm bg-transparent" 
                    type="text" 
                    placeholder="Search for products, categories..."  
                />
                <button type="submit" className="focus:outline-none">
                    <img className="w-4 cursor-pointer" src={assets.search_icon} alt="Search" />
                </button>
                
                {/* Autocomplete Dropdown List */}
                {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl text-left overflow-hidden z-50 max-h-72 overflow-y-auto">
                        {suggestions.map((item) => (
                            <div 
                                key={item._id} 
                                onClick={() => handleSuggestionClick(item._id)}
                                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                            >
                                <img 
                                    className="w-10 h-10 object-cover rounded bg-gray-100" 
                                    src={item.image[0]} 
                                    alt={item.name} 
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                                    <p className="text-xs text-gray-400">{item.category} • {item.subCategory}</p>
                                </div>
                                <p className="text-sm font-semibold text-gray-900">{currency}{item.price}</p>
                            </div>
                        ))}
                    </div>
                )}
            </form>
            <img 
                onClick={() => { setShowSearch(false); setSearch(''); }} 
                className="inline w-3 cursor-pointer ml-3 hover:scale-110 transition-transform" 
                src={assets.cross_icon} 
                alt="Close" 
            />
        </div>
    ) : null;
};

export default SearchBar;
