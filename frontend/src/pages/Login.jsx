import React, { useContext, useEffect, useState } from 'react'
import { ShopContext } from '../context/ShopContext';
import axios from 'axios';
import { toast } from 'react-toastify';

/**
 * Login / Register / OTP Verify page
 *
 * Supports:
 *  - Login  → POST /api/user/login → access token in state
 *  - Sign Up → POST /api/user/register → OTP sent to email
 *  - OTP verify → POST /api/user/verify-email → login
 *  - Forgot password → POST /api/user/forgot-password → OTP
 *  - Reset password  → POST /api/user/reset-password
 */

const STATES = {
    LOGIN: 'Login',
    SIGNUP: 'Sign Up',
    VERIFY_OTP: 'Verify Email',
    FORGOT: 'Forgot Password',
    RESET: 'Reset Password',
};

const Login = () => {
    const { token, setToken, navigate, backendUrl } = useContext(ShopContext);

    const [state, setState] = useState(STATES.LOGIN);
    const [isLoading, setIsLoading] = useState(false);

    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // OTP resend cooldown
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (token) navigate('/');
    }, [token]);

    // Countdown timer for OTP resend button
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleLogin = async () => {
        const res = await axios.post(backendUrl + '/api/user/login', { email, password });
        if (res.data.success) {
            setToken(res.data.token);
            localStorage.setItem('token', res.data.token);

            if (res.data.requiresVerification) {
                toast.info('Please verify your email first.');
                setState(STATES.VERIFY_OTP);
                setResendCooldown(60);
                return;
            }
            // Successful login → navigate handled by useEffect
        } else {
            toast.error(res.data.message);
            if (res.data.isLocked) {
                // Show countdown for locked account
            }
        }
    };

    const handleSignUp = async () => {
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters.');
            return;
        }
        const res = await axios.post(backendUrl + '/api/user/register', { name, email, password });
        if (res.data.success) {
            toast.success('Account created! Check your email for the 6-digit OTP.');
            setState(STATES.VERIFY_OTP);
            setResendCooldown(60);
        } else {
            toast.error(res.data.message);
        }
    };

    const handleVerifyOTP = async () => {
        const res = await axios.post(backendUrl + '/api/user/verify-email', { email, otp });
        if (res.data.success) {
            toast.success('Email verified! Logging you in...');
            // Auto-login after verification
            const loginRes = await axios.post(backendUrl + '/api/user/login', { email, password });
            if (loginRes.data.success) {
                setToken(loginRes.data.token);
                localStorage.setItem('token', loginRes.data.token);
            } else {
                setState(STATES.LOGIN);
                toast.info('Verified! Please log in.');
            }
        } else {
            toast.error(res.data.message);
        }
    };

    const handleResendOTP = async () => {
        if (resendCooldown > 0) return;
        try {
            const res = await axios.post(backendUrl + '/api/user/resend-otp', {
                email,
                type: state === STATES.RESET ? 'PASSWORD_RESET' : 'EMAIL_VERIFY'
            });
            if (res.data.success) {
                toast.success('New OTP sent to your email!');
                setResendCooldown(60);
            } else {
                toast.error(res.data.message);
            }
        } catch (e) {
            toast.error('Failed to resend OTP.');
        }
    };

    const handleForgotPassword = async () => {
        const res = await axios.post(backendUrl + '/api/user/forgot-password', { email });
        if (res.data.success) {
            toast.success('OTP sent to your email if the account exists.');
            setState(STATES.RESET);
            setResendCooldown(60);
        } else {
            toast.error(res.data.message);
        }
    };

    const handleResetPassword = async () => {
        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters.');
            return;
        }
        const res = await axios.post(backendUrl + '/api/user/reset-password', { email, otp, newPassword });
        if (res.data.success) {
            toast.success('Password reset! Please log in.');
            setPassword('');
            setState(STATES.LOGIN);
        } else {
            toast.error(res.data.message);
        }
    };

    // ── Form Submit ───────────────────────────────────────────────────────────

    const onSubmit = async (e) => {
        e.preventDefault();
        if (isLoading) return; // Prevent double submission
        setIsLoading(true);
        try {
            if (state === STATES.LOGIN)       await handleLogin();
            if (state === STATES.SIGNUP)      await handleSignUp();
            if (state === STATES.VERIFY_OTP)  await handleVerifyOTP();
            if (state === STATES.FORGOT)      await handleForgotPassword();
            if (state === STATES.RESET)       await handleResetPassword();
        } catch (error) {
            console.error('[Login page]', error);
            if (error.response?.status === 429) {
                toast.error('Too many attempts. Please wait 15 minutes before trying again.');
            } else {
                toast.error(error.message || 'Something went wrong. Please try again.');
            }
        } finally {
            setIsLoading(false); // Always re-enable button
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const btnText = {
        [STATES.LOGIN]: 'Sign In',
        [STATES.SIGNUP]: 'Sign Up',
        [STATES.VERIFY_OTP]: 'Verify OTP',
        [STATES.FORGOT]: 'Send Reset OTP',
        [STATES.RESET]: 'Reset Password',
    }[state];

    return (
        <form onSubmit={onSubmit} className='flex flex-col items-center w-[90%] sm:max-w-96 m-auto mt-14 gap-4 text-gray-800'>

            {/* Header */}
            <div className='inline-flex items-center gap-2 mb-2 mt-10'>
                <p className='prata-regular text-3xl'>{state}</p>
                <hr className='border-none h-[1.5px] w-8 bg-gray-800' />
            </div>

            {/* Name field (sign up only) */}
            {state === STATES.SIGNUP && (
                <input
                    onChange={e => setName(e.target.value)} value={name}
                    type='text' placeholder='Name' required
                    className='w-full px-3 py-2 border border-gray-800'
                />
            )}

            {/* Email (not shown on OTP verify if already filled) */}
            {[STATES.LOGIN, STATES.SIGNUP, STATES.FORGOT, STATES.RESET].includes(state) && (
                <input
                    onChange={e => setEmail(e.target.value)} value={email}
                    type='email' placeholder='Email' required
                    className='w-full px-3 py-2 border border-gray-800'
                />
            )}

            {/* Password (login + signup) */}
            {[STATES.LOGIN, STATES.SIGNUP].includes(state) && (
                <input
                    onChange={e => setPassword(e.target.value)} value={password}
                    type='password' placeholder='Password' required
                    className='w-full px-3 py-2 border border-gray-800'
                />
            )}

            {/* OTP field (verify + reset) */}
            {[STATES.VERIFY_OTP, STATES.RESET].includes(state) && (
                <>
                    <p className='text-sm text-gray-500 w-full'>
                        Enter the 6-digit code sent to <strong>{email}</strong>
                    </p>
                    <input
                        onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        value={otp}
                        type='text' placeholder='000000' maxLength={6}
                        inputMode='numeric' required
                        className='w-full px-3 py-2 border border-gray-800 text-center tracking-[0.5em] text-xl font-bold'
                    />
                    <button
                        type='button' onClick={handleResendOTP}
                        disabled={resendCooldown > 0}
                        className='text-sm text-blue-600 disabled:text-gray-400 cursor-pointer'
                    >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                </>
            )}

            {/* New password (reset only) */}
            {state === STATES.RESET && (
                <input
                    onChange={e => setNewPassword(e.target.value)} value={newPassword}
                    type='password' placeholder='New Password (min 8 chars)' required
                    className='w-full px-3 py-2 border border-gray-800'
                />
            )}

            {/* Bottom links */}
            <div className='w-full flex justify-between text-sm mt-[-8px]'>
                {state === STATES.LOGIN && (
                    <p className='cursor-pointer text-blue-600'
                        onClick={() => setState(STATES.FORGOT)}>
                        Forgot your password?
                    </p>
                )}
                {state === STATES.FORGOT && (
                    <p className='cursor-pointer' onClick={() => setState(STATES.LOGIN)}>
                        Back to Login
                    </p>
                )}
                {state === STATES.RESET && (
                    <p className='cursor-pointer' onClick={() => setState(STATES.LOGIN)}>
                        Back to Login
                    </p>
                )}
                <span />
                {state === STATES.LOGIN && (
                    <p className='cursor-pointer' onClick={() => setState(STATES.SIGNUP)}>
                        Create account
                    </p>
                )}
                {state === STATES.SIGNUP && (
                    <p className='cursor-pointer' onClick={() => setState(STATES.LOGIN)}>
                        Login Here
                    </p>
                )}
                {state === STATES.VERIFY_OTP && (
                    <p className='cursor-pointer' onClick={() => setState(STATES.LOGIN)}>
                        Back to Login
                    </p>
                )}
            </div>

            {/* Submit button — disabled while loading to prevent double-submit */}
            <button
                type='submit'
                disabled={isLoading}
                className='bg-black text-white font-light px-8 py-2 mt-4 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
            >
                {isLoading ? 'Please wait...' : btnText}
            </button>

        </form>
    );
};

export default Login;
