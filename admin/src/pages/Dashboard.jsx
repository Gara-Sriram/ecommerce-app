import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { backendUrl, currency } from '../App';
import { toast } from 'react-toastify';

/**
 * Admin Dashboard Page
 *
 * Exposes:
 *  1. Revenue stats & summaries.
 *  2. Top selling products (calculated via DB aggregation).
 *  3. User growth metrics.
 *  4. User role management (RBAC) allowing admins to promote/demote other users.
 */
const Dashboard = ({ token }) => {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('analytics'); // 'analytics' | 'users'

    const fetchDashboardData = async () => {
        try {
            setIsLoading(true);
            // 1. Fetch dashboard metrics & charts
            const statsRes = await axios.get(`${backendUrl}/api/order/dashboard`, {
                headers: { token }
            });
            if (statsRes.data.success) {
                setStats(statsRes.data.stats);
            } else {
                toast.error(statsRes.data.message);
            }

            // 2. Fetch user registry
            const usersRes = await axios.get(`${backendUrl}/api/user/admin/users`, {
                headers: { token }
            });
            if (usersRes.data.success) {
                setUsers(usersRes.data.users);
            } else {
                toast.error(usersRes.data.message);
            }
        } catch (error) {
            console.error('Dashboard load failed:', error);
            toast.error('Failed to load dashboard metrics.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchDashboardData();
        }
    }, [token]);

    const handleRoleChange = async (targetUserId, newRole) => {
        const confirmMsg = `Are you sure you want to change this user's role to "${newRole}"?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await axios.post(`${backendUrl}/api/user/admin/update-role`, {
                targetUserId,
                newRole
            }, {
                headers: { token }
            });

            if (res.data.success) {
                toast.success(res.data.message);
                // Refresh data
                fetchDashboardData();
            } else {
                toast.error(res.data.message);
            }
        } catch (error) {
            toast.error('Failed to update user role.');
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-96 text-gray-500">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black mr-3"></div>
                Loading Admin Analytics...
            </div>
        );
    }

    // Filter users list based on search
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Calculate chart height multipliers
    const maxRevenue = stats?.revenueTimeline?.length > 0 
        ? Math.max(...stats.revenueTimeline.map(item => item.revenue)) 
        : 1;

    const maxNewUsers = stats?.userGrowthTimeline?.length > 0
        ? Math.max(...stats.userGrowthTimeline.map(item => item.newUsers))
        : 1;

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
            {/* Header Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Business Dashboard</h1>
                    <p className="text-sm text-gray-500">Real-time overview of sales, products, and users.</p>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setActiveSection('analytics')}
                        className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all duration-200 ${
                            activeSection === 'analytics'
                                ? 'bg-white shadow text-black'
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        ANALYTICS
                    </button>
                    <button
                        onClick={() => setActiveSection('users')}
                        className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wider transition-all duration-200 ${
                            activeSection === 'users'
                                ? 'bg-white shadow text-black'
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        ROLE MANAGEMENT (RBAC)
                    </button>
                </div>
            </div>

            {/* TAB 1: Analytics Section */}
            {activeSection === 'analytics' && stats && (
                <div className="flex flex-col gap-8">
                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Revenue Card */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Sales</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">{currency}{stats.totalRevenue.toLocaleString()}</h3>
                            </div>
                            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg border border-emerald-100">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5M3.75 20.25z" />
                                </svg>
                            </div>
                        </div>

                        {/* Orders Card */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Orders</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.totalOrders}</h3>
                            </div>
                            <div className="bg-blue-50 text-blue-600 p-3 rounded-lg border border-blue-100">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5h6.75" />
                                </svg>
                            </div>
                        </div>

                        {/* Users Card */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Registered Users</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.totalUsers}</h3>
                            </div>
                            <div className="bg-purple-50 text-purple-600 p-3 rounded-lg border border-purple-100">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                                </svg>
                            </div>
                        </div>

                        {/* Products Card */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Catalog Items</p>
                                <h3 className="text-2xl font-bold text-gray-800 mt-1">{stats.totalProducts}</h3>
                            </div>
                            <div className="bg-orange-50 text-orange-600 p-3 rounded-lg border border-orange-100">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581a1.125 1.125 0 0 0 1.591 0l4.318-4.318a1.125 1.125 0 0 0 0-1.591l-9.581-9.581A2.25 2.25 0 0 0 9.568 3Z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Chart Timelines */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Chart 1: Revenue Timeline */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-800 mb-6">Revenue Trend (Last 30 Days)</h3>
                            {stats.revenueTimeline.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 text-xs">No sales recorded in the last 30 days.</div>
                            ) : (
                                <div className="flex items-end justify-between h-48 pt-6 border-b border-l px-2">
                                    {stats.revenueTimeline.map((item) => {
                                        if (!item._id) return null; // skip malformed/null entries
                                        const pct = (item.revenue / maxRevenue) * 100;
                                        return (
                                            <div key={item._id} className="flex flex-col justify-end items-center flex-1 h-full group relative">
                                                {/* Tooltip */}
                                                <span className="absolute bottom-full mb-2 bg-black text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                    {currency}{item.revenue.toLocaleString()} ({item.ordersCount} orders)
                                                </span>
                                                {/* Bar */}
                                                <div 
                                                    style={{ height: `${Math.max(pct, 5)}%` }} 
                                                    className="w-3/4 sm:w-1/2 bg-blue-500 hover:bg-blue-600 rounded-t transition-all cursor-pointer"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-1">
                                <span>30 days ago</span>
                                <span>Today</span>
                            </div>
                        </div>

                        {/* Chart 2: User Growth Timeline */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-800 mb-6">User Registrations (Last 30 Days)</h3>
                            {stats.userGrowthTimeline.length === 0 ? (
                                <div className="text-center py-20 text-gray-400 text-xs">No new users registered in the last 30 days.</div>
                            ) : (
                                <div className="flex items-end justify-between h-48 pt-6 border-b border-l px-2">
                                    {stats.userGrowthTimeline.map((item) => {
                                        if (!item._id) return null; // skip malformed/null entries
                                        const pct = (item.newUsers / maxNewUsers) * 100;
                                        return (
                                            <div key={item._id} className="flex flex-col justify-end items-center flex-1 h-full group relative">
                                                {/* Tooltip */}
                                                <span className="absolute bottom-full mb-2 bg-black text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                    {item.newUsers} new signups
                                                </span>
                                                {/* Bar */}
                                                <div 
                                                    style={{ height: `${Math.max(pct, 5)}%` }} 
                                                    className="w-3/4 sm:w-1/2 bg-purple-500 hover:bg-purple-600 rounded-t transition-all cursor-pointer"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-1">
                                <span>30 days ago</span>
                                <span>Today</span>
                            </div>
                        </div>
                    </div>

                    {/* Top Selling Products List */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-800 mb-4">⭐ Top Selling Products</h3>
                        {stats.topSellingProducts.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 text-xs">No product sales data available.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-500">
                                    <thead className="bg-gray-50 text-[11px] uppercase text-gray-400 font-semibold border-b">
                                        <tr>
                                            <th className="py-3 px-4">Product</th>
                                            <th className="py-3 px-4">Category</th>
                                            <th className="py-3 px-4 text-right">Unit Price</th>
                                            <th className="py-3 px-4 text-center">Qty Sold</th>
                                            <th className="py-3 px-4 text-right">Total Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {stats.topSellingProducts.map((prod) => (
                                            <tr key={prod._id} className="hover:bg-gray-50">
                                                <td className="py-4 px-4 font-medium text-gray-900 flex items-center gap-3">
                                                    <img className="w-10 h-10 object-cover rounded" src={prod.image[0]} alt="" />
                                                    <span className="truncate max-w-xs">{prod.name}</span>
                                                </td>
                                                <td className="py-4 px-4">{prod.category}</td>
                                                <td className="py-4 px-4 text-right">{currency}{prod.price}</td>
                                                <td className="py-4 px-4 text-center font-bold text-gray-700">{prod.totalQuantity}</td>
                                                <td className="py-4 px-4 text-right font-bold text-emerald-600">{currency}{prod.totalSales.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: RBAC Section */}
            {activeSection === 'users' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">User Directory</h3>
                            <p className="text-xs text-gray-400 mt-1">Change user access levels by modifying roles.</p>
                        </div>
                        <input
                            type="text"
                            placeholder="Search users by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="border px-4 py-2 rounded-lg text-xs w-full sm:w-64 outline-none focus:ring-1 focus:ring-black"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-500">
                            <thead className="bg-gray-50 text-[11px] uppercase text-gray-400 font-semibold border-b">
                                <tr>
                                    <th className="py-3 px-4">User Name</th>
                                    <th className="py-3 px-4">Email Address</th>
                                    <th className="py-3 px-4">Registration Date</th>
                                    <th className="py-3 px-4">Current Role</th>
                                    <th className="py-3 px-4 text-center">Change Role</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredUsers.map((user) => (
                                    <tr key={user._id} className="hover:bg-gray-50">
                                        <td className="py-4 px-4 font-semibold text-gray-800">{user.name}</td>
                                        <td className="py-4 px-4">{user.email}</td>
                                        <td className="py-4 px-4">{new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td className="py-4 px-4">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                                user.role === 'admin' 
                                                    ? 'bg-rose-50 border-rose-100 text-rose-600'
                                                    : 'bg-slate-50 border-slate-100 text-slate-500'
                                            }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleRoleChange(user._id, e.target.value)}
                                                className="border rounded text-xs px-2 py-1 outline-none focus:ring-1 focus:ring-black"
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="text-center py-10 text-gray-400 text-xs">No matching users found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
