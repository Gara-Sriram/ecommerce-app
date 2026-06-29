import React, { useContext, useState } from 'react'
import {assets} from '../assets/assets'
import { NavLink } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { ShopContext } from '../context/ShopContext'

const Navbar = () => {

  const [visible,setVisible] = useState(false);
  const {setShowSearch,getCartCount,navigate,token,setToken,setCartItems,wishlist} =  useContext(ShopContext);
  const logout = ()=>{
    navigate('/login')
    localStorage.removeItem('token')
    setToken('');
    setCartItems({})
    
  }
  return (
    <div className='flex items-center justify-between py-5 font-medium'>
      <Link to='/'>
      <img src={assets.logo} className='w-36' />
      </Link>
     
      <ul className='hidden sm:flex gap-5 text-sm text-gray-700'>
        <NavLink to='/' className='flex flex-col items-center gap-1' >
            <p>HOME</p>
            <hr className='w-2/4 border-none h-[1.5px] bg-gray-700 hidden' />
        </NavLink>
        <NavLink to='/collection' className='flex flex-col items-center gap-1' >
            <p>COLLECTION</p>
            <hr className='w-2/4 border-none h-[1.5px] bg-gray-700 hidden' />
        </NavLink>
        <NavLink to='/about' className='flex flex-col items-center gap-1' >
            <p>ABOUT</p>
            <hr className='w-2/4 border-none h-[1.5px] bg-gray-700 hidden' />
        </NavLink>
        <NavLink to='/contact' className='flex flex-col items-center gap-1' >
            <p>CONTACT</p>
            <hr className='w-2/4 border-none h-[1.5px] bg-gray-700 hidden' />
        </NavLink>
      </ul>
      <div className='flex items-center gap-6'>
        <img onClick={()=>setShowSearch(true)} src={assets.search_icon} className='w-5 cursor-pointer' alt="" ></img>
        
        {/* Profile Dropdown */}
        <div className='group relative'>
         <img onClick={()=>token?null:navigate('/login')} src={assets.profile_icon} className='w-5 cursor-pointer' alt="" />
         {token &&
            <div  className='group-hover:block hidden absolute dropdown-menu right-0 pt-4 '>
                <div className='flex flex-col gap-2 w-36 py-3 px-5 bg-slate-100 text-gray-500 rounded'>
                    <p className='cursor-pointer hover:text-black'>My Profile</p>
                    <Link to='/orders'> <p className='cursor-pointer hover:text-black'>Orders</p></Link>   
                    <p onClick={logout} className='cursor-pointer hover:text-black'>Logout</p>
                </div>
            </div>}
        </div>

        {/* Wishlist Link with Badge */}
        <Link to='/wishlist' className='relative' title="View Wishlist">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.2" 
            className="w-[21px] h-[21px] text-gray-800 hover:text-red-500 transition-colors"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          {wishlist.length > 0 && (
            <p className='absolute right-[-6px] bottom-[-6px] w-4 text-center leading-4 bg-red-500 text-white aspect-square rounded-full text-[8px] font-bold'>
              {wishlist.length}
            </p>
          )}
        </Link>

        {/* Cart Link with Badge */}
        <Link to='/cart' className='relative' >
        <img src={assets.cart_icon} className='w-5 min-w-5' ></img>
        <p className='absolute right-[-5px] bottom-[-5px] w-4 text-center leading-4 bg-black text-white aspect-square rounded-full text-[8px]'>{getCartCount()}</p>
        </Link>
        <img onClick={()=>setVisible(true)} src={assets.menu_icon} className='w-5 cursor-pointer sm:hidden'  />
      </div>
      {/* Sidebar menu for small screens */}
      <div className={`absolute top-0 right-0 bottom-0 overflow-hidden bg-white transition-all ${visible ? 'w-full': 'w-0'}`}>
        <div  className='flex flex-col text-gray-600'>
          <div onClick={()=>setVisible(false)} className='flex items-center gap-4 p-3 cursor-pointer' >
          <img className='h-4 rotate-180' src={assets.dropdown_icon} alt="" />
          <p>Back</p>
          </div>
          <NavLink  onClick={()=>setVisible(false)}  className='py-2 pl-6 border'  to='/'>HOME</NavLink>
        <NavLink onClick={()=>setVisible(false)} className='py-2 pl-6 border' to='/collection'>COLLECTION</NavLink>
        <NavLink onClick={()=>setVisible(false)} className='py-2 pl-6 border' to='/about'>ABOUT</NavLink>
        <NavLink onClick={()=>setVisible(false)} className='py-2 pl-6 border' to='/contact'>CONTACT</NavLink>
        </div>
       
      </div>
    </div>
  )
}

export default Navbar
