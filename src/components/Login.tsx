import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, Eye, EyeOff, CheckCircle2, Facebook, Twitter, Bike, Car, Truck } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth as firebaseAuth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';

interface LoginProps {
  onLogin: (role: 'admin' | 'user', identifier?: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const isValidAdmin = (username === 'ARULJOTHIAUTOCONSULTING' && password === 'Aruljothi@2009') ||
                         (username === 'ARUL JOTHI CONSULTING' && password === 'Aruljothi@2009') ||
                         (username === 'Sabari#111' && password === 'Sabari@123');

      if (isValidAdmin) {
        try {
          await signInAnonymously(firebaseAuth);
        } catch (authErr) {
          console.warn('Firebase Anonymous Auth failed, proceeding with local session:', authErr);
        }
        onLogin('admin');
      } else {
        setError('Invalid admin credentials');
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const q = query(
        collection(db, 'vehicles'),
        where('plateNumber', '==', vehicleNumber.toUpperCase())
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        try {
          await signInAnonymously(firebaseAuth);
        } catch (authErr) {
          console.warn('Firebase Anonymous Auth failed for user, proceeding:', authErr);
        }
        onLogin('user', vehicleNumber.toUpperCase());
      } else {
        setError(`SORRY, YOU ARE NOT AN ARUL JOTHI AUTO CONSULTING CUSTOMER. CONTACT: ARUL JOTHI AUTO CONSULTING`);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Could not verify vehicle. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex justify-center pt-12 md:pt-20 p-4 relative overflow-hidden font-sans">
      {/* Background Wave */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-modern-blue/5 rounded-t-[100%] scale-x-150 translate-y-1/4 opacity-50 blur-3xl" />
      
      <div className="max-w-[400px] w-full relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-modern-border"
        >
          {/* Top Blue Section */}
          <div className="bg-gradient-to-b from-modern-blue to-modern-blue/80 p-10 pb-20 relative">
            <div className="flex flex-col items-center mb-8">
              <div className="bg-white p-2 rounded-[1.5rem] shadow-2xl mb-6 transform hover:scale-105 transition-transform overflow-hidden border-4 border-white/50">
                <img 
                  src="/145.jpg" 
                  alt="Logo" 
                  className="w-32 h-48 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/LOGO.png";
                  }}
                  referrerPolicy="no-referrer"
                />
              </div>
              <h1 className="text-center leading-tight">
                <span className="text-[30px] font-bold italic font-[Georgia] text-[#b04e4e] leading-[41px] block">ARUL JOTHI</span>
                <span className="text-[22px] font-['Courier_New'] text-[#a43d3d] block">Auto Consulting</span>
              </h1>
              <p className="mt-4 text-[10px] text-white/90 font-black uppercase tracking-[0.2em] text-center bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
                Trusted RTO Solutions Since 2009
              </p>
            </div>
            
            <h2 className="text-3xl font-bold text-white text-center mb-8">Login</h2>

            {/* Mode Toggle */}
            <div className="flex bg-white/10 p-1 rounded-2xl mb-8">
              <button
                onClick={() => setIsAdminMode(false)}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${!isAdminMode ? 'bg-white text-modern-blue shadow-sm' : 'text-white/70'}`}
              >
                Customer
              </button>
              <button
                onClick={() => setIsAdminMode(true)}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${isAdminMode ? 'bg-white text-modern-blue shadow-sm' : 'text-white/70'}`}
              >
                Admin
              </button>
            </div>

            {/* Wave SVG */}
            <div className="absolute bottom-0 left-0 w-full leading-[0]">
              <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="h-20 w-full fill-white">
                <path d="M0.00,49.98 C150.00,150.00 349.20,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z"></path>
              </svg>
            </div>
          </div>

          {/* Form Section */}
          <div className="px-10 pb-12 flex-1 flex flex-col">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 bg-rose-50 text-rose-600 p-4 rounded-2xl text-[10px] font-bold text-center uppercase tracking-wider border border-rose-100"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={isAdminMode ? handleAdminLogin : handleUserLogin} className="space-y-5">
              {!isAdminMode && (
                <p className="text-[10px] text-modern-muted font-bold text-center uppercase tracking-wider leading-relaxed">
                  Note: Arul Jothi Auto Consulting customers alone should enter the vehicle number
                </p>
              )}
              <div className="relative">
                <input
                  required
                  type="text"
                  placeholder={isAdminMode ? "Username" : "Vehicle Number (TN-XX-XXXX)"}
                  className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-2 focus:ring-modern-blue/20 focus:border-modern-blue outline-none transition-all text-base font-medium placeholder:text-slate-400 pr-12 text-modern-text"
                  value={isAdminMode ? username : vehicleNumber}
                  onChange={(e) => isAdminMode ? setUsername(e.target.value) : setVehicleNumber(e.target.value.toUpperCase())}
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300">
                  <CheckCircle2 className={`w-5 h-5 transition-colors ${(isAdminMode ? username : vehicleNumber) ? 'text-modern-blue' : ''}`} />
                </div>
              </div>

              {isAdminMode && (
                <div className="relative">
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-2 focus:ring-modern-blue/20 focus:border-modern-blue outline-none transition-all text-base font-medium placeholder:text-slate-400 pr-12 text-modern-text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-modern-blue transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              )}

              <button
                disabled={loading}
                type="submit"
                className="w-full bg-modern-blue hover:bg-modern-blue/90 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-modern-blue/20 active:scale-[0.98] text-base disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Login'}
              </button>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-xl bg-modern-blue/5 flex items-center justify-center mb-2">
                      <Shield className="w-4 h-4 text-modern-blue" />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-modern-muted">Secure</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-xl bg-modern-blue/5 flex items-center justify-center mb-2">
                      <CheckCircle2 className="w-4 h-4 text-modern-blue" />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-modern-muted">Verified</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-xl bg-modern-blue/5 flex items-center justify-center mb-2">
                      <Lock className="w-4 h-4 text-modern-blue" />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-modern-muted">Private</span>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
