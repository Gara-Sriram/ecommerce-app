import React, { useContext, useEffect, useState } from 'react';
import { ShopContext } from '../context/ShopContext';
import axios from 'axios';
import { toast } from 'react-toastify';

/**
 * Product Reviews & Ratings Component
 *
 * Features:
 *  - Displays list of reviews with star ratings and comments.
 *  - Green "Verified Purchase" badge for users who bought the item.
 *  - Dynamic form to write a review.
 *  - Rating input using interactive star selection.
 *  - User can delete their own review.
 */
const ProductReviews = ({ productId }) => {
    const { token, backendUrl, navigate } = useContext(ShopContext);

    const [reviews, setReviews] = useState([]);
    const [eligibility, setEligibility] = useState({ eligible: false, verifiedPurchase: false });
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState('reviews'); // 'reviews' | 'write'

    // Fetch reviews
    const fetchReviews = async () => {
        try {
            const res = await axios.get(`${backendUrl}/api/product/reviews/${productId}`);
            if (res.data.success) {
                setReviews(res.data.reviews);
            }
        } catch (error) {
            console.error('Error fetching reviews:', error);
        }
    };

    // Check if user is eligible to write a review
    const checkEligibility = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${backendUrl}/api/product/reviews/eligible/${productId}`, {
                headers: { token }
            });
            if (res.data.success) {
                setEligibility({
                    eligible: res.data.eligible,
                    verifiedPurchase: res.data.verifiedPurchase
                });
            }
        } catch (error) {
            console.error('Error checking eligibility:', error);
        }
    };

    useEffect(() => {
        fetchReviews();
        checkEligibility();
    }, [productId, token]);

    // Handle add review
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) {
            toast.error('Please log in to write a review.');
            navigate('/login');
            return;
        }

        if (comment.trim().length < 5) {
            toast.error('Review comment must be at least 5 characters long.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await axios.post(`${backendUrl}/api/product/reviews/add`, {
                productId,
                rating,
                comment
            }, {
                headers: { token }
            });

            if (res.data.success) {
                toast.success('Review published!');
                setComment('');
                setRating(5);
                setActiveTab('reviews');
                fetchReviews();
                checkEligibility();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error('Failed to submit review.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle delete review
    const handleDelete = async (reviewId) => {
        if (!window.confirm('Are you sure you want to delete your review?')) return;

        try {
            const res = await axios.delete(`${backendUrl}/api/product/reviews/delete/${reviewId}`, {
                headers: { token }
            });
            if (res.data.success) {
                toast.success('Review deleted.');
                fetchReviews();
                checkEligibility();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error('Failed to delete review.');
        }
    };

    // Helper: render stars
    const renderStars = (num) => {
        return (
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                    <span
                        key={s}
                        className={`text-lg ${s <= num ? 'text-orange-500' : 'text-gray-300'}`}
                    >
                        ★
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="mt-10 border-t pt-8">
            {/* Header Tabs */}
            <div className="flex gap-4 border-b mb-6">
                <button
                    onClick={() => setActiveTab('reviews')}
                    className={`pb-3 text-sm font-semibold tracking-wider transition-all duration-200 ${
                        activeTab === 'reviews'
                            ? 'border-b-2 border-black text-black'
                            : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    CUSTOMER REVIEWS ({reviews.length})
                </button>
                {token && eligibility.eligible && (
                    <button
                        onClick={() => setActiveTab('write')}
                        className={`pb-3 text-sm font-semibold tracking-wider transition-all duration-200 ${
                            activeTab === 'write'
                                ? 'border-b-2 border-black text-black'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        WRITE A REVIEW
                    </button>
                )}
            </div>

            {/* TAB: Reviews List */}
            {activeTab === 'reviews' && (
                <div className="flex flex-col gap-6">
                    {reviews.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            No reviews yet. Be the first to review this product!
                        </div>
                    ) : (
                        reviews.map((rev) => (
                            <div key={rev._id} className="border-b pb-5 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-semibold text-gray-800 text-sm">{rev.userName}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            {renderStars(rev.rating)}
                                            <span className="text-[11px] text-gray-400">
                                                {new Date(rev.createdAt).toLocaleDateString()}
                                            </span>
                                            {rev.verifiedPurchase && (
                                                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-0.5">
                                                    ✓ Verified Purchase
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Delete Button (if owned review) */}
                                    {token && rev.user && (
                                        <button
                                            onClick={() => handleDelete(rev._id)}
                                            className="text-[11px] text-red-500 hover:underline hover:text-red-700"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 leading-relaxed mt-2">{rev.comment}</p>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* TAB: Write Review Form */}
            {activeTab === 'write' && (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg bg-gray-50 p-6 rounded-lg border">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Overall Rating</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setRating(s)}
                                    className="text-2xl transition-transform active:scale-95"
                                >
                                    <span className={s <= rating ? 'text-orange-500' : 'text-gray-300'}>
                                        ★
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Review Details</label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="What did you like or dislike? Write your review..."
                            rows="4"
                            required
                            className="w-full border rounded p-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black"
                        />
                    </div>

                    {eligibility.verifiedPurchase && (
                        <div className="text-[12px] text-emerald-600 font-medium bg-emerald-50 p-2.5 rounded border border-emerald-100">
                            ✨ You purchased this item! Your review will have a <strong>Verified Purchase</strong> badge.
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-black text-white py-2 px-6 text-sm font-medium tracking-wide hover:bg-gray-800 disabled:bg-gray-400 active:scale-[0.98] transition-all"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                </form>
            )}
        </div>
    );
};

export default ProductReviews;
