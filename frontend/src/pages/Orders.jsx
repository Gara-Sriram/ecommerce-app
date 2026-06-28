import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext'
import Title from '../components/Title';
import axios from 'axios';
import { toast } from 'react-toastify';

const Orders = () => {
  const { backendUrl, token, currency } = useContext(ShopContext);
  const [orderData, setOrderData] = useState([]);

  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [returnForm, setReturnForm] = useState({ reason: '', condition: 'Like New', shareLocation: true });
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const loadOrderData = async () => {
    try {
      if (!token) return null;
      const response = await axios.post(backendUrl + '/api/order/userorders', {}, { headers: { token } });
      if (response.data.success) {
        let allOrdersItem = [];
        response.data.orders.map((order) => {
          order.items.map((item) => {
            item['status'] = order.status;
            item['payment'] = order.payment;
            item['paymentMethod'] = order.paymentMethod;
            item['date'] = order.date;
            item['orderId'] = order._id;
            allOrdersItem.push(item);
          });
        });
        setOrderData(allOrdersItem.reverse());
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => { loadOrderData(); }, [token]);

  // Status color helper
  const getStatusColor = (status) => {
    const map = {
      'Delivered': '#22c55e',
      'Shipped': '#3b82f6',
      'Out for Delivery': '#f59e0b',
      'Order Placed': '#8b5cf6',
      'Return Initiated': '#ef4444',
      'Cancelled': '#6b7280',
    };
    return map[status] || '#6b7280';
  };

  const canReturn = (status) =>
    ['Delivered', 'Order Placed', 'Shipped', 'Out for Delivery'].includes(status);

  const handleOpenReturn = (item) => {
    setSelectedItem(item);
    setReturnForm({ reason: '', condition: 'Like New', shareLocation: true });
    setShowReturnModal(true);
  };

  const handleSubmitReturn = async () => {
    if (!returnForm.reason) {
      toast.error('Please select a return reason.');
      return;
    }
    setSubmittingReturn(true);
    try {
      let latitude = 0, longitude = 0, locationLabel = 'Location not shared';

      // Get user's location if they agreed to share it
      if (returnForm.shareLocation) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
          locationLabel = 'Near your current location';
        } catch {
          toast.info('Location not available — listing without location.');
        }
      }

      const response = await axios.post(
        backendUrl + '/api/returns/initiate',
        {
          orderId: selectedItem.orderId,
          productId: selectedItem._id,
          reason: returnForm.reason,
          condition: returnForm.condition,
          size: selectedItem.size,
          latitude, longitude, locationLabel
        },
        { headers: { token } }
      );

      if (response.data.success) {
        toast.success(`Return initiated! 🎉 You'll earn ₹${response.data.cashbackAmount} cashback if it sells locally.`);
        setShowReturnModal(false);
        loadOrderData();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
    setSubmittingReturn(false);
  };

  return (
    <div className='border-t pt-16'>
      <div className='text-2xl mb-6'>
        <Title text1={'MY'} text2={'ORDERS'} />
      </div>

      {orderData.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <p style={{ fontSize: '48px', marginBottom: '12px' }}>📦</p>
          <p style={{ fontSize: '18px', fontWeight: '500' }}>No orders yet</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>Start shopping to see your orders here!</p>
        </div>
      )}

      <div>
        {orderData.map((item, index) => (
          <div key={index} className='py-4 border-t border-b text-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
            <div className='flex items-start gap-6 text-sm'>
              <img className='w-16 sm:w-20 object-cover rounded' src={item.image[0]} alt={item.name} />
              <div>
                <p className='sm:text-base font-medium'>{item.name}</p>
                <div className='flex items-center gap-3 mt-1 text-base text-gray-700'>
                  <p className='text-lg'>{currency}{item.price}</p>
                  <p>Qty: {item.quantity}</p>
                  <p>Size: {item.size}</p>
                </div>
                <p className='mt-1 text-sm'>Date: <span className='text-gray-400'>{new Date(item.date).toDateString()}</span></p>
                <p className='mt-1 text-sm'>Payment: <span className='text-gray-400'>{item.paymentMethod}</span></p>
              </div>
            </div>

            <div className='md:w-1/2 flex justify-between items-center'>
              {/* Status badge */}
              <div className='flex items-center gap-2'>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: getStatusColor(item.status), display: 'inline-block'
                }} />
                <p className='text-sm font-medium'>{item.status}</p>
              </div>

              {/* Buttons */}
              <div className='flex gap-2'>
                <button
                  onClick={loadOrderData}
                  className='border px-4 py-2 text-sm font-medium rounded-sm hover:bg-gray-50 transition'
                >
                  Track Order
                </button>
                {canReturn(item.status) && (
                  <button
                    onClick={() => handleOpenReturn(item)}
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white', border: 'none',
                      padding: '8px 16px', borderRadius: '4px',
                      fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={e => e.target.style.opacity = '0.85'}
                    onMouseOut={e => e.target.style.opacity = '1'}
                  >
                    Return Item
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Return Modal ───────────────────────────────────────── */}
      {showReturnModal && selectedItem && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              padding: '20px 24px', color: 'white'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Return Item</h2>
              <p style={{ margin: '4px 0 0', fontSize: '14px', opacity: 0.8 }}>
                {selectedItem.name} — {currency}{selectedItem.price}
              </p>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Reason */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Reason for return *
                </label>
                <select
                  value={returnForm.reason}
                  onChange={e => setReturnForm(f => ({ ...f, reason: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: '1.5px solid #d1d5db', fontSize: '14px', color: '#374151',
                    background: 'white', outline: 'none'
                  }}
                >
                  <option value=''>Select a reason</option>
                  <option>Wrong size</option>
                  <option>Not as described</option>
                  <option>Didn't like it</option>
                  <option>Defective</option>
                  <option>Changed mind</option>
                  <option>Other</option>
                </select>
              </div>

              {/* Condition */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Item condition
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['Like New', 'Good', 'Acceptable'].map(cond => (
                    <button
                      key={cond}
                      onClick={() => setReturnForm(f => ({ ...f, condition: cond }))}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '500',
                        border: returnForm.condition === cond ? '2px solid #667eea' : '1.5px solid #d1d5db',
                        background: returnForm.condition === cond ? '#ede9fe' : 'white',
                        color: returnForm.condition === cond ? '#4f46e5' : '#6b7280',
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      {cond}
                    </button>
                  ))}
                </div>
              </div>

              {/* Local Resale Option */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                border: '1.5px solid #86efac', borderRadius: '12px', padding: '16px', marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <input
                    type='checkbox'
                    id='shareLocation'
                    checked={returnForm.shareLocation}
                    onChange={e => setReturnForm(f => ({ ...f, shareLocation: e.target.checked }))}
                    style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer' }}
                  />
                  <label htmlFor='shareLocation' style={{ cursor: 'pointer' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#15803d', margin: '0 0 4px' }}>
                      🏷️ List for nearby buyers (Recommended)
                    </p>
                    <p style={{ fontSize: '12px', color: '#166534', margin: 0, lineHeight: '1.5' }}>
                      We'll show your item to buyers within 50km at <strong>25% off</strong>.
                      If it sells locally, you earn <strong>₹{Math.floor((selectedItem.price || 0) * 0.02)} cashback</strong> and
                      avoid the hassle of shipping it back!
                    </p>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowReturnModal(false)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px', border: '1.5px solid #d1d5db',
                    background: 'white', color: '#374151', fontSize: '14px', fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReturn}
                  disabled={submittingReturn}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '8px', border: 'none',
                    background: submittingReturn
                      ? '#9ca3af'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white', fontSize: '14px', fontWeight: '600',
                    cursor: submittingReturn ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {submittingReturn ? 'Submitting...' : 'Submit Return Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
