import { useState, useMemo, useEffect } from 'react';
import { Bell, Shield, Car, Phone, MapPin, AlertCircle, LogOut, ExternalLink, ChevronRight, CreditCard, Plus, MessageSquare, Mail, Receipt, FileText, Printer, X, Layout as LayoutIcon, Home, FileCheck, Users, Globe, Menu } from 'lucide-react';
const AadharIcon = Printer;
import VehicleList from './components/VehicleList';
import VehicleDetails from './components/VehicleDetails';
import BulkImport from './components/BulkImport';
import WebsiteLinks from './components/WebsiteLinks';
import TaxDashboard from './components/TaxDashboard';
import BillingDashboard from './components/BillingDashboard';
import CustomerBillDashboard from './components/CustomerBillDashboard';
import AadharPrintDashboard from './components/AadharPrintDashboard';
import TaxReportDashboard from './components/TaxReportDashboard';
import Login from './components/Login';
import UserDashboard from './components/UserDashboard';
import SystemSettings from './components/SystemSettings';
import { Vehicle } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { differenceInDays, isBefore } from 'date-fns';
import { doc, getDocFromServer, collection, query, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './lib/firestore-utils';
import { cn } from './lib/utils';

import Logo from './components/Logo';

export default function App() {
  const [auth, setAuth] = useState<{ role: 'admin' | 'user'; identifier?: string } | null>(() => {
    const saved = localStorage.getItem('arul_jothi_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [importType, setImportType] = useState<'vehicles' | 'tax'>('vehicles');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | undefined>();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'vehicles' | 'links' | 'tax' | 'reports' | 'accounts' | 'customer-bill' | 'aadhar-print'>('vehicles');
  const [dbError, setDbError] = useState<string | null>(null);
  const [expiryFilterOverride, setExpiryFilterOverride] = useState<'all' | 'expired' | '0' | '1' | '7' | '15' | '30' | 'month' | 'nextMonth'>('all');
  const [reminderDays, setReminderDays] = useState(15);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'vahan_config'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.expiryReminderDays) {
          setReminderDays(data.expiryReminderDays);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function testConnection() {
      const path = '_connection_test_/ping';
      try {
        await getDocFromServer(doc(db, '_connection_test_', 'ping'));
        setDbError(null); // Clear error if successful
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('unavailable') || error.message.includes('offline')) {
            setDbError("Database Connection Error: The application cannot reach the backend. Please check your internet or re-run Firebase setup.");
          } else if (error.message.includes('permission') || error.message.includes('denied')) {
            setDbError("Database Permission Error: Access denied. This usually means the security rules need to be updated.");
            handleFirestoreError(error, OperationType.GET, path);
          } else {
            setDbError(`Database Error: ${error.message}`);
          }
        }
      }
    }
    testConnection();
    
    // Retry every 30 seconds if there's an error
    const interval = setInterval(() => {
      if (dbError) testConnection();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [dbError]);

  useEffect(() => {
    if (auth?.role === 'admin') {
      const q = query(collection(db, 'vehicles'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const vehicleData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Vehicle[];
        setVehicles(vehicleData);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching vehicles:", error);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [auth]);

  useEffect(() => {
    if (auth) {
      localStorage.setItem('arul_jothi_auth', JSON.stringify(auth));
    } else {
      localStorage.removeItem('arul_jothi_auth');
    }
  }, [auth]);

  const expiringCount = useMemo(() => {
    return vehicles.filter(v => {
      const dates = [v.fcExpiry, v.permitExpiry, v.insuranceExpiry, v.nationalPermitExpiry].filter(Boolean);
      return dates.some(d => {
        const date = new Date(d!);
        const today = new Date();
        return isBefore(date, today) || differenceInDays(date, today) <= reminderDays;
      });
    }).length;
  }, [vehicles, reminderDays]);

  const handleLogin = (role: 'admin' | 'user', identifier?: string) => {
    setAuth({ role, identifier });
  };

  const handleLogout = () => {
    setAuth(null);
  };

  const handleViewDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
  };

  const navItems = useMemo(() => [
    { id: 'vehicles', label: 'Vehicles', icon: Car, color: 'text-modern-blue', bg: 'bg-modern-blue/10' },
    { id: 'links', label: 'Links', icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { id: 'tax', label: 'Tax', icon: FileCheck, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'reports', label: 'Reports', icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { id: 'accounts', label: 'Accounts', icon: CreditCard, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { id: 'customer-bill', label: 'Bills', icon: Receipt, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { id: 'aadhar-print', label: 'Aadhar', icon: AadharIcon, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  ], []);

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  if (auth.role === 'user') {
    return <UserDashboard identifier={auth.identifier!} onLogout={handleLogout} reminderDays={reminderDays} />;
  }

  return (
    <div className="min-h-screen bg-transparent text-modern-text font-sans selection:bg-modern-blue/10 selection:text-modern-blue flex flex-col lg:flex-row relative overflow-hidden">
      {/* Background Wave Effect (Simplified) */}
      <div className="absolute bottom-0 left-0 right-0 h-[70%] bg-modern-bg/60 backdrop-blur-sm rounded-t-[5rem] z-0" />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-80 modern-sidebar sticky top-0 h-screen z-50">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-10">
            <div className="flex items-center gap-5 mb-12">
              <div className="bg-modern-blue/5 p-2 rounded-2xl border border-modern-blue/10 transform hover:rotate-6 transition-transform relative">
                <Logo className="w-12 h-12 object-contain" />
                {vehicles.length > 0 && (
                  <div className="absolute -top-2 -right-2 bg-modern-blue text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg border-2 border-white z-10">
                    {vehicles.length}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-xl font-display font-bold tracking-tight text-modern-text leading-[0.9]">
                  ARUL JOTHI<br />
                  <span className="text-modern-blue uppercase text-[10px] tracking-[0.3em] font-black">Auto Consulting</span>
                </h1>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all duration-300 relative rounded-2xl",
                    activeTab === item.id
                      ? "bg-modern-blue/5 text-modern-blue shadow-[0_4px_20px_rgba(0,136,255,0.08)]"
                      : "text-modern-muted hover:bg-slate-50 hover:text-modern-text"
                  )}
                >
                  <div className="relative">
                    <item.icon className={cn("w-5 h-5 transition-all duration-500", activeTab === item.id ? item.color : "text-slate-400")} />
                    {item.id === 'vehicles' && expiringCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white" />
                    )}
                  </div>
                  <span className="tracking-wide">{item.label}</span>
                  {item.id === 'vehicles' && expiringCount > 0 && (
                    <span className="ml-auto bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                      {expiringCount}
                    </span>
                  )}
                  {activeTab === item.id && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute left-0 w-1.5 h-6 bg-modern-blue rounded-full"
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-10 border-t border-modern-border space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-[2rem] border border-modern-border">
              <div className="w-12 h-12 rounded-2xl bg-modern-blue flex items-center justify-center text-modern-text font-black text-lg shadow-lg shadow-modern-blue/20">
                {auth.role === 'admin' ? 'A' : 'C'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-modern-text uppercase tracking-widest truncate">
                  {auth.role === 'admin' ? 'Administrator' : 'Customer Account'}
                </p>
                <p className="text-[9px] text-modern-muted font-bold uppercase tracking-widest truncate mt-0.5">
                  {auth.identifier || 'Active Session'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowSettings(true)}
                className="flex-1 py-4 bg-slate-50 border border-modern-border text-modern-muted hover:text-modern-blue hover:border-modern-blue/20 hover:bg-modern-blue/5 rounded-2xl transition-all flex items-center justify-center active:scale-95"
                title="Settings"
              >
                <div className="relative">
                  <Shield className="w-5 h-5 mr-2" />
                  {expiringCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white" />
                  )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Settings</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-4 bg-slate-50 border border-modern-border text-modern-muted hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 rounded-2xl transition-all flex items-center justify-center active:scale-95"
                title="Logout"
              >
                <LogOut className="w-5 h-5 mr-2" />
                <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden bg-white/95 backdrop-blur-md border-b border-modern-border sticky top-0 z-40 px-6 h-28 flex items-center justify-center shadow-sm relative">
        <div className="flex flex-col items-center">
          <div className="mb-2 relative">
            <Logo className="w-10 h-10 object-contain" />
            {vehicles.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-modern-blue text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-lg border-2 border-white z-10">
                {vehicles.length}
              </div>
            )}
          </div>
          <div className="text-center">
            <h1 className="flex flex-col items-center">
              <span className="text-base font-bold italic font-[Georgia] text-[#b04e4e] tracking-tight leading-none">ARUL JOTHI</span>
              <span className="text-[10px] font-['Courier_New'] text-[#a43d3d] font-bold uppercase tracking-[0.2em] mt-0.5">Auto Consulting</span>
            </h1>
          </div>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="absolute right-6 p-2 text-modern-text hover:bg-slate-50 transition-colors rounded-xl border border-modern-border shadow-sm active:scale-95"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Side Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-modern-text/20 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-[300px] bg-white z-[70] lg:hidden shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-modern-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Logo className="w-8 h-8" />
                  <span className="text-xs font-black uppercase tracking-widest text-modern-text">Menu</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-modern-muted hover:text-modern-text transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 px-6 py-4 text-sm font-bold transition-all duration-300 rounded-2xl",
                      activeTab === item.id
                        ? "bg-modern-blue/5 text-modern-blue border border-modern-blue/10"
                        : "text-modern-muted hover:bg-slate-50"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", activeTab === item.id ? item.color : "text-slate-400")} />
                    <span className="tracking-wide">{item.label}</span>
                  </button>
                ))}
                
                <div className="my-6 border-t border-modern-border" />
                
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-6 py-4 text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all rounded-2xl"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="tracking-wide">Logout</span>
                </button>
              </nav>

              <div className="p-8 border-t border-modern-border bg-slate-50">
                <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-modern-border shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-modern-blue flex items-center justify-center text-modern-text font-black text-sm">
                    {auth.role === 'admin' ? 'A' : 'C'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-modern-text uppercase tracking-widest truncate">
                      {auth.role === 'admin' ? 'Administrator' : 'Customer Account'}
                    </p>
                    <p className="text-[8px] text-modern-muted font-bold truncate">
                      {auth.identifier || 'Active Session'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto pb-24 lg:pb-0 relative z-10">
        <AnimatePresence mode="wait">
          {dbError && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-rose-500 text-white px-8 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-between sticky top-20 lg:top-0 z-30 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4" />
                {dbError}
              </div>
              <button onClick={() => setDbError(null)} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSettings && (
            <SystemSettings onClose={() => setShowSettings(false)} />
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'vehicles' && (
              <VehicleList 
                onViewDetails={handleViewDetails} 
                vehicles={vehicles}
                loading={loading}
                reminderDays={reminderDays}
                initialExpiryFilter={expiryFilterOverride}
                isAdmin={auth.role === 'admin'}
                onImport={() => { setImportType('vehicles'); setShowImport(true); }}
              />
            )}
            {activeTab === 'links' && <WebsiteLinks />}
            {activeTab === 'tax' && <TaxDashboard onImport={() => { setImportType('tax'); setShowImport(true); }} />}
            {activeTab === 'reports' && <TaxReportDashboard />}
            {activeTab === 'accounts' && <BillingDashboard />}
            {activeTab === 'customer-bill' && <CustomerBillDashboard />}
            {activeTab === 'aadhar-print' && <AadharPrintDashboard />}
          </motion.div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {selectedVehicle && (
          <VehicleDetails 
            vehicle={selectedVehicle} 
            onClose={() => setSelectedVehicle(undefined)} 
            isAdmin={auth.role === 'admin'}
          />
        )}
        {showImport && (
          <BulkImport 
            type={importType}
            onClose={() => setShowImport(false)} 
            onSuccess={() => setShowImport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
