import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Logo from './Logo';

interface BulkImportProps {
  onClose: () => void;
  onSuccess: () => void;
  type?: 'vehicles' | 'tax';
}

export default function BulkImport({ onClose, onSuccess, type = 'vehicles' }: BulkImportProps) {
  const [csvData, setCsvData] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState(0);

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    // Detect delimiter (comma, tab, or semicolon)
    const firstLine = lines[0];
    let delimiter = ',';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';')) delimiter = ';';

    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i].split(delimiter).map(v => v.trim());
      if (currentLine.length < 2) continue; // Skip empty lines

      const item: any = {};
      headers.forEach((header, index) => {
        const value = currentLine[index];
        if (!value) return;

        // Prioritize specific matches to avoid "number" matching both plate and phone
        if (header.includes('plate') || header === 'reg' || header.includes('registration') || header.includes('vehicle')) {
          item.plateNumber = value.toUpperCase();
        } else if (header.includes('phone') || header.includes('mobile') || header.includes('whatsapp') || header.includes('contact')) {
          item.phoneNumber = value;
        } else if (header.includes('owner') || header.includes('customer') || header === 'name') {
          item.ownerName = value;
        } else if (header === 'fc' || header.includes('fc expiry') || header.includes('fitness')) {
          item.fcExpiry = value;
        } else if (header.includes('national') || header.includes('np') || header.includes('n.p')) {
          item.nationalPermitExpiry = value;
        } else if (header.includes('permit')) {
          item.permitExpiry = value;
        } else if (header.includes('insurance') || header.includes('ins')) {
          item.insuranceExpiry = value;
        } else if (header.includes('tax amount') || header.includes('amount')) {
          item.taxAmount = value;
        } else if (header.includes('gt')) {
          item.gt = value;
        } else if (header.includes('info')) {
          item.information = value;
        } else if (header.includes('paid date')) {
          item.paidDate = value;
        } else if (header.includes('in date')) {
          item.inDate = value;
        } else if (header.includes('tax period') || header.includes('period')) {
          item.taxType = value;
        } else if (header.includes('number') && !item.plateNumber) {
          // Fallback for "Number" if plateNumber hasn't been set yet
          item.plateNumber = value.toUpperCase();
        }
      });

      // Basic validation: at least plate number is required
      if (item.plateNumber) {
        // Provide defaults for missing required fields to be more lenient
        item.ownerName = item.ownerName || 'Unknown Owner';
        item.phoneNumber = item.phoneNumber || '';
        item.createdAt = new Date().toISOString();
        results.push(item);
      }
    }
    return results;
  };

  const handleImport = async () => {
    if (!csvData.trim()) {
      setError('Please paste your CSV data first.');
      return;
    }

    setLoading(true);
    setError('');
    const items = parseCSV(csvData);

    if (items.length === 0) {
      setError(`No valid ${type} data found. Please check your CSV format.`);
      setLoading(false);
      return;
    }

    try {
      let count = 0;
      const collectionName = type === 'tax' ? 'tax_records' : 'vehicles';
      for (const item of items) {
        await addDoc(collection(db, collectionName), item);
        count++;
      }
      setSuccessCount(count);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Import error:', err);
      setError(`Failed to import some ${type}. Please check your connection.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-cyber-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-cyber-dark rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-white/5">
        <div className="bg-black/40 p-6 flex justify-between items-center text-white border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="bg-white/5 p-1 rounded-xl shadow-lg border border-white/10">
              <Logo className="w-8 h-8 object-contain" />
            </div>
            <h2 className="text-xl font-display font-bold tracking-tight uppercase">
              Bulk Import {type === 'tax' ? 'Tax Records' : 'Database'}
            </h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-xl transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="bg-cyber-purple/5 p-6 rounded-[2rem] border border-cyber-purple/10">
            <div className="flex items-start gap-4">
              <div className="bg-cyber-purple/10 p-3 rounded-2xl">
                <FileText className="w-6 h-6 text-cyber-purple" />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">{type === 'tax' ? 'Tax Data Format' : 'CSV Format Instructions'}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Paste your spreadsheet data below. Ensure headers match columns like: 
                  <code className="bg-white/5 px-2 py-0.5 rounded border border-white/10 mx-1 font-mono text-xs text-cyber-purple">
                    {type === 'tax' 
                      ? 'Plate Number, Owner, Phone, Tax Amount, GT, Info, Paid Date, In Date, Tax Period'
                      : 'Plate Number, Owner Name, Phone Number, FC Expiry, Permit Expiry, Insurance Expiry'}
                  </code>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-slate-500 uppercase tracking-widest">Paste CSV Data</label>
            <textarea
              className="w-full h-64 px-5 py-4 bg-cyber-dark/50 border border-white/5 rounded-[2rem] focus:ring-2 focus:ring-cyber-purple/50 focus:bg-cyber-dark outline-none transition-all font-mono text-sm text-slate-300 resize-none placeholder:text-slate-700"
              placeholder="Plate Number, Owner Name, Phone Number, FC Expiry...&#10;TN-01-AB-1234, John Doe, 919876543210, 2025-12-31..."
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-rose-500/5 text-rose-500 rounded-2xl border border-rose-500/10">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-bold">{error}</p>
            </div>
          )}

          {successCount > 0 && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/5 text-emerald-500 rounded-2xl border border-emerald-500/10">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-bold">Successfully imported {successCount} {type === 'tax' ? 'records' : 'vehicles'}!</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 border border-white/10 text-slate-500 font-black uppercase tracking-widest rounded-2xl hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading || successCount > 0}
              className="flex-1 px-6 py-4 bg-cyber-purple text-white font-black uppercase tracking-widest rounded-2xl hover:bg-cyber-purple/80 transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Start Import
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
