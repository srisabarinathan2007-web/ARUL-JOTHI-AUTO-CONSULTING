import React from 'react';
import { Vehicle } from '../types';
import { X, Calendar, User, Phone, Hash, Shield, FileText, Globe, Clock, MessageSquare, RefreshCw, ExternalLink, AlertCircle, CheckCircle2, CreditCard, Car } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { sendWhatsAppReminder } from '../services/whatsappService';
import { syncVehicleWithApi } from '../services/vahanService';
import Logo from './Logo';
import { useState } from 'react';

interface VehicleDetailsProps {
  vehicle: Vehicle;
  onClose: () => void;
  isAdmin: boolean;
}

export default function VehicleDetails({ vehicle, onClose, isAdmin }: VehicleDetailsProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(false);
    
    try {
      await syncVehicleWithApi(vehicle);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (error: any) {
      if (error.message === 'VAHAN_API_KEY_MISSING') {
        setSyncError('API Key Missing. Go to Settings to add it.');
      } else if (error.message === 'INVALID_API_KEY') {
        setSyncError('Invalid API Key. Please check your settings.');
      } else if (error.message === 'API_FETCH_FAILED') {
        setSyncError('Vahan API is currently unavailable.');
      } else {
        setSyncError('Failed to sync. Please check your connection.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSendReminder = async (type: string, date: string) => {
    const result = await sendWhatsAppReminder(
      vehicle.phoneNumber,
      vehicle.ownerName,
      vehicle.plateNumber,
      type,
      date
    );
    if (!result.automated && result.url) {
      window.open(result.url, '_blank');
    } else if (result.automated) {
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    }
  };

  const DetailItem = ({ icon: Icon, label, value, date, type }: { icon: any, label: string, value?: string, date?: string, type?: string }) => {
    const isExpired = date ? new Date(date) < new Date() : false;
    
    return (
      <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
        <div className={cn(
          "p-3 rounded-xl",
          date ? (isExpired ? "bg-rose-500/10 text-rose-500" : "bg-cyber-purple/10 text-cyber-purple") : "bg-cyber-purple/10 text-cyber-purple"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
          <p className="text-slate-300 font-bold">
            {date ? format(new Date(date), 'dd MMMM yyyy') : value}
          </p>
          {date && (
            <p className={cn("text-[10px] font-bold mt-1 uppercase", isExpired ? "text-rose-500" : "text-emerald-500")}>
              {isExpired ? "Expired" : "Valid"}
            </p>
          )}
        </div>
        {isAdmin && date && (
          <button 
            onClick={() => handleSendReminder(type || label, date)}
            className="self-center p-2 text-cyber-purple hover:bg-cyber-purple/10 rounded-lg transition-colors"
            title="Send Reminder"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-cyber-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-cyber-dark rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-white/5">
        <div className="bg-black/40 p-8 md:p-10 flex justify-between items-center text-white relative overflow-hidden border-b border-white/5">
          <div className="relative z-10 flex items-center gap-6">
            <div className="bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-white/10">
              <Car className="w-10 h-10 text-cyber-purple shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 bg-cyber-purple rounded-full animate-pulse shadow-[0_0_5px_rgba(168,85,247,0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Vehicle Profile</span>
              </div>
              <h2 className="text-3xl font-display font-bold tracking-tight uppercase leading-none">{vehicle.plateNumber}</h2>
              <p className="text-slate-500 text-xs font-bold mt-2 uppercase tracking-widest opacity-80">{vehicle.ownerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="relative z-10 hover:bg-white/10 p-3 rounded-2xl transition-all active:scale-90 border border-white/5">
            <X className="w-6 h-6 text-slate-400" />
          </button>
          
          {/* Abstract Background Shapes */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-cyber-purple/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-48 h-48 bg-cyber-blue/10 rounded-full blur-3xl" />
        </div>

        <div className="p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 px-1">Owner & Contact</h3>
            <DetailItem icon={User} label="Owner Name" value={vehicle.ownerName} />
            <DetailItem icon={Phone} label="WhatsApp Number" value={vehicle.phoneNumber} />
            <DetailItem icon={Hash} label="Registration No." value={vehicle.plateNumber} />
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-600 px-1">RTO Documents</h3>
            <DetailItem icon={Calendar} label="FC Expiry" date={vehicle.fcExpiry} type="FC" />
            <DetailItem icon={FileText} label="Permit Expiry" date={vehicle.permitExpiry} type="Permit" />
            <DetailItem icon={Shield} label="Insurance Expiry" date={vehicle.insuranceExpiry} type="Insurance" />
            {vehicle.nationalPermitExpiry && (
              <DetailItem icon={Globe} label="National Permit" date={vehicle.nationalPermitExpiry} type="National Permit" />
            )}
          </div>

          {vehicle.lastReminderSent && (
            <div className="md:col-span-2 mt-4 p-4 bg-cyber-blue/5 rounded-2xl border border-cyber-blue/10 flex items-center gap-3">
              <Clock className="w-5 h-5 text-cyber-blue" />
              <p className="text-sm font-bold text-slate-300">
                Last reminder sent on: <span className="text-cyber-blue">{format(new Date(vehicle.lastReminderSent), 'dd MMM yyyy, hh:mm a')}</span>
              </p>
            </div>
          )}

          {vehicle.lastSync && (
            <div className="md:col-span-2 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-bold text-slate-300">
                Last synced with Vahan: <span className="text-emerald-500">{format(new Date(vehicle.lastSync), 'dd MMM yyyy, hh:mm a')}</span>
              </p>
            </div>
          )}
        </div>

        <div className="p-8 bg-black/20 border-t border-white/5 flex flex-col gap-4">
          {syncError && (
            <div className="flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-wider bg-rose-500/5 p-3 rounded-xl border border-rose-500/10">
              <AlertCircle className="w-4 h-4" />
              {syncError}
            </div>
          )}
          {syncSuccess && (
            <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-wider bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
              <CheckCircle2 className="w-4 h-4" />
              Data Updated Successfully!
            </div>
          )}
          <div className="flex justify-end items-center">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-white/5 border border-white/10 text-slate-400 font-black rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
