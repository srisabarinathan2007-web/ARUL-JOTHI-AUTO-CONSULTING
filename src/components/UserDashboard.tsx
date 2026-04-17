import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Vehicle } from '../types';
import { Car, User, Phone, Hash, Calendar, FileText, Shield, Globe, LogOut, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { differenceInDays, format, isBefore } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import Logo from './Logo';

interface UserDashboardProps {
  identifier: string;
  onLogout: () => void;
  reminderDays?: number;
}

export default function UserDashboard({ identifier, onLogout, reminderDays = 15 }: UserDashboardProps) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVehicle() {
      try {
        const q = query(
          collection(db, 'vehicles'),
          where('plateNumber', '==', identifier)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          setVehicle({ id: doc.id, ...doc.data() } as Vehicle);
        } else {
          setError('Vehicle not found');
        }
      } catch (err) {
        console.error('Error fetching vehicle:', err);
        setError('Failed to load vehicle details');
      } finally {
        setLoading(false);
      }
    }
    fetchVehicle();
  }, [identifier]);

  const DetailItem = ({ icon: Icon, label, value, date }: { icon: any, label: string, value?: string, date?: string }) => {
    const isExpired = date ? isBefore(new Date(date), new Date()) : false;
    const isSoon = date ? !isExpired && differenceInDays(new Date(date), new Date()) <= reminderDays : false;
    
    return (
      <div className="flex items-start gap-4 p-5 bg-white/50 backdrop-blur-sm rounded-3xl border border-white shadow-sm hover:shadow-md transition-all">
        <div className={cn(
          "p-3 rounded-2xl",
          date ? (
            isExpired ? "bg-rose-500/10 text-rose-500" : 
            isSoon ? "bg-orange-500/10 text-orange-500" :
            "bg-modern-blue/10 text-modern-blue"
          ) : "bg-modern-blue/10 text-modern-blue"
        )}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
          <p className="text-modern-text font-bold text-lg">
            {date ? format(new Date(date), 'dd MMMM yyyy') : value}
          </p>
          {date && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full", 
                isExpired ? "bg-rose-500" : 
                isSoon ? "bg-orange-500" : 
                "bg-emerald-500"
              )} />
              <p className={cn(
                "text-[10px] font-black uppercase tracking-wider", 
                isExpired ? "text-rose-500" : 
                isSoon ? "text-orange-500" : 
                "text-emerald-500"
              )}>
                {isExpired ? "Expired" : isSoon ? "Expiring Soon" : "Valid"}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-10 h-10 text-modern-blue animate-spin" />
          <p className="text-xs font-black uppercase tracking-[0.3em] text-modern-muted">Loading Details...</p>
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent p-6">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-2xl border border-modern-border text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-modern-text mb-2">Error</h2>
          <p className="text-modern-muted font-medium mb-8">{error || 'Something went wrong'}</p>
          <button
            onClick={onLogout}
            className="w-full bg-modern-blue text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-modern-blue/20"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8 lg:p-12 relative overflow-hidden">
      {/* Background Wave */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 bg-modern-blue/5 rounded-t-[100%] scale-x-150 translate-y-1/4 opacity-50 blur-3xl -z-10" />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-6">
            <div className="bg-white p-2 rounded-[1.5rem] shadow-xl border-4 border-white/50 overflow-hidden">
              <Logo className="w-20 h-20 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-modern-muted">Active Session</span>
              </div>
              <h1 className="text-4xl font-display font-bold tracking-tight text-modern-text leading-none">
                {vehicle.plateNumber}
              </h1>
              <p className="text-modern-muted font-bold mt-2 uppercase tracking-widest text-sm">
                {vehicle.ownerName}
              </p>
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-8 py-4 bg-white/80 backdrop-blur-md border border-modern-border text-modern-muted hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 rounded-2xl transition-all shadow-sm font-black uppercase tracking-widest text-xs active:scale-95"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-xl bg-modern-blue/10 flex items-center justify-center">
                <User className="w-4 h-4 text-modern-blue" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-modern-text">Owner Information</h3>
            </div>
            <DetailItem icon={User} label="Owner Name" value={vehicle.ownerName} />
            <DetailItem icon={Phone} label="WhatsApp Number" value={vehicle.phoneNumber} />
            <DetailItem icon={Hash} label="Registration No." value={vehicle.plateNumber} />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-emerald-500" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-modern-text">Document Expiry Dates</h3>
            </div>
            <DetailItem icon={Calendar} label="FC Expiry" date={vehicle.fcExpiry} />
            <DetailItem icon={FileText} label="Permit Expiry" date={vehicle.permitExpiry} />
            <DetailItem icon={Shield} label="Insurance Expiry" date={vehicle.insuranceExpiry} />
            {vehicle.nationalPermitExpiry && (
              <DetailItem icon={Globe} label="National Permit" date={vehicle.nationalPermitExpiry} />
            )}
          </motion.div>
        </div>

        {/* Footer Note */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-8 bg-white/40 backdrop-blur-sm rounded-[2.5rem] border border-white/50 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-black uppercase tracking-widest text-modern-text">Verified by Arul Jothi Auto Consulting</span>
          </div>
          <p className="text-sm text-modern-muted font-medium max-w-lg mx-auto leading-relaxed">
            Please ensure your documents are renewed before expiry to avoid penalties. 
            Contact us for any assistance with your vehicle documentation.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
