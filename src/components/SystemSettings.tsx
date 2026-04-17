import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Save, Key, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from './Logo';

interface SystemSettingsProps {
  onClose: () => void;
}

export default function SystemSettings({ onClose }: SystemSettingsProps) {
  const [apiKey, setApiKey] = useState('');
  const [whatsappInstanceId, setWhatsappInstanceId] = useState('');
  const [whatsappToken, setWhatsappToken] = useState('');
  const [expiryReminderDays, setExpiryReminderDays] = useState('15');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'vahan_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setApiKey(data.vahanApiKey || '');
          setWhatsappInstanceId(data.whatsappInstanceId || '');
          setWhatsappToken(data.whatsappToken || '');
          setExpiryReminderDays(data.expiryReminderDays || '15');
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, 'settings', 'vahan_config'), {
        vahanApiKey: apiKey,
        whatsappInstanceId,
        whatsappToken,
        expiryReminderDays: parseInt(expiryReminderDays) || 15,
        updatedAt: new Date().toISOString()
      });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100"
      >
        <div className="bg-slate-900 p-8 flex justify-between items-center text-white">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1 rounded-xl shadow-lg">
              <Logo className="w-10 h-10 object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-80">Arul Jothi Auto Consulting</p>
              <h2 className="text-xl font-black uppercase tracking-widest">System Settings</h2>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Configuration...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-8">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Vahan API Settings</h3>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                    Vahan API Key
                  </label>
                  <div className="relative group">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                    <input
                      type="password"
                      placeholder="Enter Vahan API key..."
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium text-slate-600 placeholder:text-slate-400"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <p className="mt-3 text-[10px] text-slate-400 font-medium leading-relaxed px-1">
                    Get your API key from <a href="https://digitap.ai" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-bold">DigitAP</a> or <a href="https://rapidapi.com/search/rto" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline font-bold">RapidAPI</a> to enable automatic data sync with mParivahan/Vahan.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">WhatsApp API Settings (UltraMsg)</h3>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                    Instance ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. instance12345"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium text-slate-600 placeholder:text-slate-400"
                    value={whatsappInstanceId}
                    onChange={(e) => setWhatsappInstanceId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                    API Token
                  </label>
                  <input
                    type="password"
                    placeholder="Enter WhatsApp API token..."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium text-slate-600 placeholder:text-slate-400"
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed px-1">
                  Required for sending messages automatically without opening a new tab.
                </p>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Reminder Settings</h3>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">
                    Alert Frequency (Days Before Expiry)
                  </label>
                  <div className="relative group">
                    <AlertCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                    <input
                      type="number"
                      min="1"
                      max="365"
                      placeholder="e.g. 15"
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium text-slate-600 placeholder:text-slate-400"
                      value={expiryReminderDays}
                      onChange={(e) => setExpiryReminderDays(e.target.value)}
                    />
                  </div>
                  <p className="mt-3 text-[10px] text-slate-400 font-medium leading-relaxed px-1">
                    Vehicles with documents expiring within this many days will be highlighted and counted in the "Expiring Soon" dashboard.
                  </p>
                </div>
              </div>

              {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
                  message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                  {message.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <p className="text-xs font-bold uppercase tracking-wider">{message.text}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-brand-200/50 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
