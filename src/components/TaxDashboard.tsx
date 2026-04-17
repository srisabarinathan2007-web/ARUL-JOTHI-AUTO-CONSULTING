import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { TaxRecord } from '../types';
import { CreditCard, Search, AlertTriangle, CheckCircle2, Phone, MessageSquare, Loader2, Calendar, Plus, X, Trash2, Edit2, Download, FileSpreadsheet, Car, Printer, ExternalLink } from 'lucide-react';
import { format, isBefore, differenceInDays } from 'date-fns';
import { cn } from '../lib/utils';
import { sendWhatsAppReminder } from '../services/whatsappService';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Logo from './Logo';

interface TaxDashboardProps {
  onImport?: () => void;
}

export default function TaxDashboard({ onImport }: TaxDashboardProps) {
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTaxType, setFilterTaxType] = useState('');
  const [filterPeriodType, setFilterPeriodType] = useState<'all' | 'Quarterly' | 'Annual'>('all');
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  
  // Inline editing states
  const [editingId, setEditingId] = useState<string | null>(null); // For existing records
  const [addingIndex, setAddingIndex] = useState<number | null>(null); // For new empty rows
  const [editData, setEditData] = useState<Partial<TaxRecord>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [view, setView] = useState<'categories' | 'table'>('categories');
  const [deletingRecord, setDeletingRecord] = useState<TaxRecord | null>(null);

  const calculateTaxPeriod = (dateStr: string | undefined, periodType: 'Quarterly' | 'Annual'): string => {
    if (!periodType) return '';
    const date = dateStr ? new Date(dateStr) : new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12

    if (periodType === 'Annual') {
      // If date is after March 31
      if (month > 3 || (month === 3 && date.getDate() > 31)) {
        return `31-Mar-${year} to 31-03-${year + 1}`;
      } else {
        return `31-Mar-${year - 1} to 31-03-${year}`;
      }
    } else {
      // Quarterly
      if (month >= 4 && month <= 6) return `01-04-${year} to 30-06-${year}`;
      if (month >= 7 && month <= 9) return `01-07-${year} to 30-09-${year}`;
      if (month >= 10 && month <= 12) return `01-10-${year} to 31-12-${year}`;
      return `01-01-${year} to 31-03-${year}`;
    }
  };

  const currentQuarter = useMemo(() => calculateTaxPeriod(undefined, 'Quarterly'), []);
  const currentAnnual = useMemo(() => calculateTaxPeriod(undefined, 'Annual'), []);

  const totalRows = 600;

  const annualOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      `31-Mar-${currentYear} to 31-03-${currentYear + 1}`,
      `31-Mar-${currentYear + 1} to 31-03-${currentYear + 2}`
    ];
  }, []);

  const quarterlyOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear + 1];
    const options: string[] = [];
    years.forEach(year => {
      options.push(`01-04-${year} to 30-06-${year}`);
      options.push(`01-07-${year} to 30-09-${year}`);
      options.push(`01-10-${year} to 31-12-${year}`);
      options.push(`01-01-${year} to 31-03-${year}`);
    });
    return options;
  }, []);

  const taxTypeOptions = useMemo(() => {
    const all = [...annualOptions, ...quarterlyOptions];
    return all.sort((a, b) => {
      // Extract the first year found in the string
      const yearA = parseInt(a.match(/\d{4}/)?.[0] || '0');
      const yearB = parseInt(b.match(/\d{4}/)?.[0] || '0');
      
      if (yearA !== yearB) return yearA - yearB;
      
      // If same year, put Annual first, then Q1, Q2, Q3, Q4
      const isAnnualA = a.includes('31-Mar');
      const isAnnualB = b.includes('31-Mar');
      if (isAnnualA && !isAnnualB) return -1;
      if (!isAnnualA && isAnnualB) return 1;
      
      // Sort quarters
      return a.localeCompare(b);
    });
  }, [annualOptions, quarterlyOptions]);

  useEffect(() => {
    const qTax = query(collection(db, 'tax_records'), orderBy('plateNumber', 'asc'));
    const unsubscribeTax = onSnapshot(qTax, (snapshot) => {
      const taxData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaxRecord[];
      setRecords(taxData);
      setLoading(false);
    });

    return () => {
      unsubscribeTax();
    };
  }, []);

  const filteredRecords = records.filter(r => {
    const matchesSearch = 
      r.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.taxType && r.taxType.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.taxPeriodType && r.taxPeriodType.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTaxType = !filterTaxType || r.taxType === filterTaxType;
    const matchesPeriodType = filterPeriodType === 'all' || 
      (filterPeriodType === 'Quarterly' && r.taxType === currentQuarter) ||
      (filterPeriodType === 'Annual' && r.taxType === currentAnnual);
    
    return matchesSearch && matchesTaxType && matchesPeriodType;
  });

  const uniqueTaxTypes = useMemo(() => {
    const types = Array.from(new Set([...taxTypeOptions, ...records.map(r => r.taxType).filter(Boolean)]));
    return types.sort((a, b) => {
      const yearA = parseInt(a.match(/\d{4}/)?.[0] || '0');
      const yearB = parseInt(b.match(/\d{4}/)?.[0] || '0');
      if (yearA !== yearB) return yearA - yearB;
      const isAnnualA = a.includes('31-Mar');
      const isAnnualB = b.includes('31-Mar');
      if (isAnnualA && !isAnnualB) return -1;
      if (!isAnnualA && isAnnualB) return 1;
      return a.localeCompare(b);
    });
  }, [records, taxTypeOptions]);

  // Create the 600 rows: filtered records first, then empty rows
  const displayRows = useMemo(() => {
    const rows = [...filteredRecords];
    const emptyCount = Math.max(0, totalRows - rows.length);
    for (let i = 0; i < emptyCount; i++) {
      rows.push({} as TaxRecord);
    }
    return rows;
  }, [filteredRecords]);

  const handleExportExcel = () => {
    const exportData = filteredRecords.map((r, index) => ({
      'S.NO': index + 1,
      'VEHICLE NUMBER': r.plateNumber,
      'OWNER NAME': r.ownerName,
      'TAX TYPE': r.taxPeriodType || '',
      'TAX AMOUNT': r.taxAmount,
      'GT': r.gt,
      'INFORMATION': r.information,
      'IN DATE': r.inDate ? format(new Date(r.inDate), 'dd/MM/yyyy') : '',
      'PAID DATE': r.paidDate ? format(new Date(r.paidDate), 'dd/MM/yyyy') : '',
      'PHONE NUMBER': r.phoneNumber
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tax Records");
    
    const fileName = `Arul_Jothi_Tax_Report_${format(new Date(), 'dd_MMM_yyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrint = () => {
    // Close any active edits
    setEditingId(null);
    setAddingIndex(null);
    
    // Focus and print
    window.focus();
    window.print();
  };

  const handleAddRecord = useCallback(async () => {
    if (!editData.plateNumber || !editData.ownerName || !editData.phoneNumber) {
      return;
    }
    setActionLoading(true);
    try {
      // Strip id if it exists
      const { id, ...dataToSave } = editData as any;
      const docRef = await addDoc(collection(db, 'tax_records'), {
        ...dataToSave,
        createdAt: new Date().toISOString()
      });
      // Switch to editing mode for the newly created record
      setEditingId(docRef.id);
      setAddingIndex(null);
    } catch (error) {
      console.error('Error adding record:', error);
    } finally {
      setActionLoading(false);
    }
  }, [editData]);

  const handleUpdateRecord = useCallback(async (id: string, silent = false) => {
    if (!silent) setActionLoading(true);
    else setAutoSaving(true);
    
    try {
      // Strip id from data to save
      const { id: _, ...dataToSave } = editData as any;
      await updateDoc(doc(db, 'tax_records', id), dataToSave);
      if (!silent) {
        setEditingId(null);
        setEditData({});
      }
    } catch (error) {
      console.error('Error updating record:', error);
    } finally {
      setActionLoading(false);
      setAutoSaving(false);
    }
  }, [editData]);

  const handleDone = async () => {
    if (editingId) {
      await handleUpdateRecord(editingId);
    } else if (addingIndex !== null) {
      if (editData.plateNumber && editData.ownerName && editData.phoneNumber) {
        await handleAddRecord();
        setEditingId(null);
        setEditData({});
      } else {
        // Just cancel if not enough data
        setAddingIndex(null);
        setEditData({});
      }
    } else {
      setEditingId(null);
      setAddingIndex(null);
      setEditData({});
    }
  };

  // Auto-save effect
  useEffect(() => {
    if (Object.keys(editData).length === 0) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      if (editingId) {
        handleUpdateRecord(editingId, true);
      } else if (addingIndex !== null && editData.plateNumber && editData.ownerName && editData.phoneNumber) {
        handleAddRecord();
      }
    }, 500);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [editData, editingId, addingIndex, handleUpdateRecord, handleAddRecord]);

  const handleDelete = async (record: TaxRecord) => {
    setDeletingRecord(record);
  };

  const confirmDelete = async () => {
    if (!deletingRecord?.id) return;
    
    try {
      await deleteDoc(doc(db, 'tax_records', deletingRecord.id));
      setDeletingRecord(null);
    } catch (error) {
      console.error('Error deleting record:', error);
    }
  };

  const handleSendReminder = async (record: TaxRecord) => {
    setSendingId(record.id || null);
    try {
      const expiryDate = record.taxType?.includes(' to ') 
        ? record.taxType.split(' to ')[1] 
        : (record.taxType || 'Tax');

      const result = await sendWhatsAppReminder(
        record.phoneNumber,
        record.ownerName,
        record.plateNumber,
        'Tax',
        expiryDate
      );
      
      if (record.id) {
        await updateDoc(doc(db, 'tax_records', record.id), {
          lastReminderSent: new Date().toISOString()
        });
      }

      if (!result.automated && result.url) {
        window.open(result.url, '_blank');
      }
    } catch (error) {
      console.error('Error sending reminder:', error);
    } finally {
      setSendingId(null);
    }
  };

  const handleRowClick = useCallback(async (record: TaxRecord, index: number) => {
    // Save current work if any before switching
    if (editingId) {
      await handleUpdateRecord(editingId, true);
    } else if (addingIndex !== null && editData.plateNumber && editData.ownerName && editData.phoneNumber) {
      await handleAddRecord();
    }

    if (record.id) {
      setEditingId(record.id);
      setEditData(record);
      setAddingIndex(null);
    } else {
      const periodType = filterTaxType ? (filterTaxType.includes('31-Mar') ? 'Annual' : 'Quarterly') : (filterPeriodType !== 'all' ? filterPeriodType : undefined);
      setAddingIndex(index);
      setEditingId(null);
      setEditData({ 
        phoneNumber: '', 
        taxType: filterTaxType,
        taxPeriodType: periodType
      });
    }
  }, [editingId, addingIndex, editData, handleUpdateRecord, handleAddRecord, filterTaxType, filterPeriodType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-modern-blue animate-spin" />
        <p className="text-xs font-black text-modern-muted uppercase tracking-[0.3em]">Loading Tax Records...</p>
      </div>
    );
  }

  const renderCategories = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => { setFilterTaxType(''); setView('table'); }}
        className="p-8 modern-card rounded-[2.5rem] hover:border-modern-blue transition-all flex flex-col items-center text-center gap-6 group"
      >
        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center group-hover:bg-modern-blue transition-colors overflow-hidden p-2 border border-modern-border">
          <Logo className="w-full h-full object-contain" />
        </div>
        <div>
          <h3 className="text-xl font-display font-bold text-modern-text uppercase tracking-tight">All Records</h3>
          <p className="text-modern-muted text-xs font-bold uppercase tracking-widest mt-2">{records.length} Total Vehicles</p>
        </div>
      </motion.button>

      {taxTypeOptions.map((type) => {
        const count = records.filter(r => r.taxType === type).length;
        const isAnnual = type.includes('31-Mar');
        const isQ1 = type.includes('04-') || type.includes('06-');
        const isQ2 = type.includes('07-') || type.includes('09-');
        const isQ3 = type.includes('10-') || type.includes('12-');
        const isQ4 = type.includes('01-') || type.includes('03-');
        
        let colorClass = "bg-modern-blue/5 group-hover:bg-modern-blue text-modern-blue";
        if (isQ1) colorClass = "bg-emerald-500/5 group-hover:bg-emerald-500 text-emerald-500";
        if (isQ2) colorClass = "bg-amber-500/5 group-hover:bg-amber-500 text-amber-500";
        if (isQ3) colorClass = "bg-indigo-500/5 group-hover:bg-indigo-500 text-indigo-500";
        if (isQ4) colorClass = "bg-rose-500/5 group-hover:bg-rose-500 text-rose-500";

        return (
          <motion.button
            key={type}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setFilterTaxType(type); setView('table'); }}
            className="p-8 modern-card rounded-[2.5rem] hover:border-modern-blue transition-all flex flex-col items-center text-center gap-6 group"
          >
            <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center transition-colors overflow-hidden p-2 border border-modern-border",
              colorClass.split(' ')[0],
              colorClass.split(' ')[2]
            )}>
              <Logo className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-modern-text uppercase tracking-tight leading-tight">{type}</h3>
              <p className="text-modern-muted text-xs font-bold uppercase tracking-widest mt-2">{count} Records</p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-10 bg-modern-blue rounded-full shadow-lg shadow-modern-blue/20" />
          <div>
            <h2 className="text-3xl font-display font-bold text-modern-text tracking-tight uppercase flex items-center gap-3">
              Tax Dashboard
              {autoSaving && (
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full animate-pulse border border-emerald-500/20">
                  AUTO-SAVING...
                </span>
              )}
            </h2>
            <p className="text-modern-muted text-[10px] font-black uppercase tracking-[0.3em] mt-1">
              {view === 'categories' ? 'Select a Tax Category' : `Viewing: ${filterTaxType || 'All Records'}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {view === 'table' && (
            <button
              onClick={() => setView('categories')}
              className="px-6 py-4 bg-white border border-modern-border text-modern-muted rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:text-modern-text transition-all flex items-center gap-2 shadow-sm active:scale-95 no-print"
            >
              <X className="w-4 h-4" />
              Back to Categories
            </button>
          )}
          
          <div className="relative group flex-1 md:w-64 no-print">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-modern-blue transition-colors" />
            <input
              type="text"
              placeholder="Search records..."
              className="w-full pl-14 pr-6 py-4 bg-white border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text shadow-sm placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {view === 'table' && (
            <select
              className="px-6 py-4 bg-white border border-modern-border text-modern-muted rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue transition-all shadow-sm no-print"
              value={filterPeriodType}
              onChange={(e) => setFilterPeriodType(e.target.value as any)}
            >
              <option value="all">All Records</option>
              <option value="Quarterly">Current Quarter</option>
              <option value="Annual">Current Year (Annual)</option>
            </select>
          )}

          <button
            onClick={handleExportExcel}
            className="bg-white border border-modern-border text-modern-muted p-4 rounded-2xl shadow-sm hover:bg-slate-50 hover:text-modern-blue transition-all active:scale-95 flex items-center gap-2"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Export</span>
          </button>

          {onImport && (
            <button
              onClick={onImport}
              className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2 no-print"
              title="Bulk Import Data"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Bulk Import</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="bg-modern-blue text-white p-4 rounded-2xl shadow-lg shadow-modern-blue/20 hover:bg-modern-blue/80 transition-all active:scale-95 flex items-center gap-2 no-print"
            title="Print Report"
          >
            <Printer className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Print Only Header */}
      <div className="hidden print:block mb-2 border-b border-slate-900 pb-1 print-only-header relative">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-3 mb-0.5">
            <Logo className="w-8 h-8 object-contain" />
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Arul Jothi Auto Consulting</h1>
          </div>
          <p className="text-slate-900 font-black uppercase tracking-[0.3em] text-[11px]">TAX DETAILS</p>
        </div>
        
        <div className="absolute top-0 right-0 text-right">
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Report Generated</p>
          <p className="text-[9px] font-bold text-slate-900">{format(new Date(), 'dd MMM yyyy')} • {format(new Date(), 'hh:mm a')}</p>
        </div>

        <div className="mt-1 flex justify-center gap-3">
          {filterTaxType && (
            <div className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Tax Category</p>
              <p className="text-[9px] font-bold text-slate-900 uppercase">{filterTaxType}</p>
            </div>
          )}
          <div className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Status</p>
            <p className="text-[9px] font-bold text-slate-900 uppercase">Active Records</p>
          </div>
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        {view === 'categories' ? (
          <motion.div
            key="categories"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="print-container"
          >
            {renderCategories()}
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="modern-card rounded-[2rem] overflow-hidden print-container"
          >
            <div className="overflow-x-auto max-h-[85vh] overflow-y-auto print:overflow-visible">
              <table className={cn(
                "w-full text-left border-collapse table-fixed print:min-w-0",
                filterTaxType ? "min-w-[1400px]" : "min-w-[900px]"
              )}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-modern-border print:bg-slate-50">
                    <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-12 border-r border-modern-border text-center">S.NO</th>
                    <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-36 border-r border-modern-border">Vehicle Number</th>
                    <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-40 border-r border-modern-border">Owner Name</th>
                    <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-28 border-r border-modern-border">Phone</th>
                    <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-24 border-r border-modern-border">Tax Type</th>
                    <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-48 border-r border-modern-border">Tax Period</th>
                    <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-24 border-r border-modern-border">Tax Amount</th>
                    {filterTaxType && (
                      <>
                        <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-20 border-r border-modern-border">GT</th>
                        <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-48 border-r border-modern-border">Information</th>
                        <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-28 border-r border-modern-border">IN Date</th>
                        <th className="p-1.5 print:p-1 text-[9px] print:text-[8px] font-black text-modern-muted uppercase tracking-widest w-28 border-r border-modern-border">Paid Date</th>
                      </>
                    )}
                    <th className="p-1.5 print:p-1 text-[9px] font-black text-modern-muted uppercase tracking-widest w-24 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-modern-border">
                  {displayRows.map((record, index) => {
                    const isExisting = !!record.id;
                    const isEditing = (isExisting && editingId === record.id) || (!isExisting && addingIndex === index);

                    return (
                      <tr key={isExisting ? record.id : `empty-${index}`} className={cn(
                        "hover:bg-slate-50 transition-colors group h-8",
                        isEditing ? "bg-modern-blue/5" : "",
                        !isExisting && !isEditing ? "bg-transparent" : ""
                      )}>
                        <td className="px-1.5 text-[10px] font-black text-modern-muted border-r border-modern-border text-center">{index + 1}</td>
                        
                        {isEditing ? (
                          <>
                            <td className="px-3 border-r border-modern-border">
                              <input
                                className="w-full px-2 py-1 bg-white border border-modern-border rounded text-xs font-bold uppercase outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                value={editData.plateNumber || ''}
                                onChange={(e) => setEditData({ ...editData, plateNumber: e.target.value.toUpperCase() })}
                                onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                                placeholder="Plate No"
                                autoFocus
                              />
                            </td>
                            <td className="px-3 border-r border-modern-border">
                              <input
                                className="w-full px-2 py-1 bg-white border border-modern-border rounded text-xs font-bold outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                value={editData.ownerName || ''}
                                onChange={(e) => setEditData({ ...editData, ownerName: e.target.value })}
                                onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                                placeholder="Owner Name"
                              />
                            </td>
                            <td className="px-3 border-r border-modern-border">
                              <input
                                className="w-full px-2 py-1 bg-white border border-modern-border rounded text-xs font-bold outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                value={editData.phoneNumber || ''}
                                onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                                onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                                placeholder="Phone"
                              />
                            </td>
                            <td className="px-3 border-r border-modern-border">
                              <select
                                className="w-full px-2 py-1 bg-white border border-modern-border rounded text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                value={editData.taxPeriodType || ''}
                                onChange={(e) => {
                                  const type = e.target.value as 'Quarterly' | 'Annual';
                                  const dateToUse = editData.inDate || format(new Date(), 'yyyy-MM-dd');
                                  const period = calculateTaxPeriod(dateToUse, type);
                                  setEditData({ 
                                    ...editData, 
                                    taxPeriodType: type, 
                                    taxType: period,
                                    inDate: dateToUse
                                  });
                                }}
                                onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                              >
                                <option value="">Select Type</option>
                                <option value="Quarterly">Quarterly</option>
                                <option value="Annual">Annual</option>
                              </select>
                            </td>
                            <td className="px-3 border-r border-modern-border">
                              <select
                                className="w-full px-2 py-1 bg-white border border-modern-border rounded text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                value={editData.taxType || ''}
                                onChange={(e) => setEditData({ ...editData, taxType: e.target.value })}
                                onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                              >
                                <option value="">Select Period</option>
                                {(editData.taxPeriodType === 'Annual' ? annualOptions : 
                                  editData.taxPeriodType === 'Quarterly' ? quarterlyOptions : 
                                  taxTypeOptions).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 border-r border-modern-border">
                              <input
                                type="number"
                                className="w-full px-2 py-1 bg-white border border-modern-border rounded text-xs font-bold outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                value={editData.taxAmount || ''}
                                onChange={(e) => setEditData({ ...editData, taxAmount: e.target.value })}
                                onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                                placeholder="Amount"
                              />
                            </td>
                            {filterTaxType && (
                              <>
                                <td className="px-3 border-r border-modern-border">
                                  <input
                                    className="w-full px-2 py-1 bg-white border border-modern-border rounded text-xs font-bold outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                    value={editData.gt || ''}
                                    onChange={(e) => setEditData({ ...editData, gt: e.target.value })}
                                    onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                                    placeholder="GT"
                                  />
                                </td>
                                <td className="px-3 border-r border-modern-border">
                                  <input
                                    className="w-full px-2 py-1 bg-white border border-modern-border rounded text-xs font-bold outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                    value={editData.information || ''}
                                    onChange={(e) => setEditData({ ...editData, information: e.target.value })}
                                    onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                                    placeholder="Info"
                                  />
                                </td>
                                <td className="px-3 border-r border-modern-border">
                                  <input
                                    type="date"
                                    className="w-full px-2 py-1 bg-white border border-modern-border rounded text-[10px] font-bold outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                    value={editData.inDate || ''}
                                    onChange={(e) => {
                                      const date = e.target.value;
                                      const period = editData.taxPeriodType ? calculateTaxPeriod(date, editData.taxPeriodType) : '';
                                      setEditData({ ...editData, inDate: date, taxType: period });
                                    }}
                                    onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                                  />
                                </td>
                                <td className="px-3 border-r border-modern-border">
                                  <input
                                    type="date"
                                    className="w-full px-2 py-1 bg-white border border-modern-border rounded text-[10px] font-bold outline-none focus:ring-1 focus:ring-modern-blue text-modern-text"
                                    value={editData.paidDate || ''}
                                    onChange={(e) => setEditData({ ...editData, paidDate: e.target.value })}
                                    onBlur={() => editingId && handleUpdateRecord(editingId, true)}
                                  />
                                </td>
                              </>
                            )}
                            <td className="px-3 no-print">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => { setEditingId(null); setAddingIndex(null); setEditData({}); }}
                                  className="p-1.5 text-modern-muted hover:bg-slate-50 rounded flex items-center gap-1"
                                  title="Close"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-black uppercase">Close</span>
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-1.5 border-r border-modern-border cursor-pointer" onClick={() => handleRowClick(record, index)}>
                              <span className="text-[11px] font-black text-modern-text uppercase tracking-tight group-hover:text-modern-blue transition-colors">{record.plateNumber || ''}</span>
                            </td>
                            <td className="px-1.5 border-r border-modern-border cursor-pointer" onClick={() => handleRowClick(record, index)}>
                              <span className="text-[11px] font-bold text-modern-muted">{record.ownerName || ''}</span>
                            </td>
                            <td className="px-1.5 border-r border-modern-border cursor-pointer" onClick={() => handleRowClick(record, index)}>
                              <span className="text-[11px] font-bold text-modern-muted">{record.phoneNumber || ''}</span>
                            </td>
                            <td className="px-1.5 border-r border-modern-border cursor-pointer" onClick={() => handleRowClick(record, index)}>
                              {record.id ? (
                                <span className={cn(
                                  "text-[8px] font-black px-1 py-0.5 rounded-full uppercase tracking-widest",
                                  record.taxPeriodType === 'Annual' ? "bg-modern-blue/10 text-modern-blue" : "bg-emerald-500/10 text-emerald-500"
                                )}>
                                  {record.taxPeriodType || 'N/A'}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-1.5 border-r border-modern-border cursor-pointer" onClick={() => handleRowClick(record, index)}>
                              <span className="text-[8px] font-bold text-modern-muted uppercase">{record.taxType || ''}</span>
                            </td>
                            <td className="px-1.5 border-r border-modern-border text-[11px] font-bold text-modern-text cursor-pointer" onClick={() => handleRowClick(record, index)}>
                              {record.taxAmount ? `₹${record.taxAmount}` : ''}
                            </td>
                            {filterTaxType && (
                              <>
                                <td className="px-1.5 border-r border-modern-border text-[11px] font-bold text-modern-text cursor-pointer" onClick={() => handleRowClick(record, index)}>
                                  {record.gt || ''}
                                </td>
                                <td className="px-1.5 border-r border-modern-border text-[9px] text-modern-muted truncate cursor-pointer" title={record.information} onClick={() => handleRowClick(record, index)}>
                                  {record.information || ''}
                                </td>
                                <td className="px-1.5 border-r border-modern-border text-[9px] font-bold text-modern-muted cursor-pointer" onClick={() => handleRowClick(record, index)}>
                                  {record.inDate ? format(new Date(record.inDate), 'dd/MM/yyyy') : ''}
                                </td>
                                <td className="px-1.5 border-r border-modern-border text-[9px] font-bold text-modern-muted cursor-pointer" onClick={() => handleRowClick(record, index)}>
                                  {record.paidDate ? format(new Date(record.paidDate), 'dd/MM/yyyy') : ''}
                                </td>
                              </>
                            )}
                            <td className="px-1.5 no-print">
                              {isExisting && (
                                <div className="flex justify-end items-center gap-1">
                                  <button
                                    onClick={() => handleSendReminder(record)}
                                    disabled={sendingId === record.id}
                                    className="p-1.5 text-modern-blue hover:bg-modern-blue/5 rounded transition-colors"
                                    title="Send WhatsApp Reminder"
                                  >
                                    {sendingId === record.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingId(record.id!);
                                      setEditData(record);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-modern-blue hover:bg-modern-blue/5 rounded transition-colors"
                                    title="Edit Record"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(record)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                                    title="Delete Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingRecord && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="bg-red-600 p-6 flex justify-between items-center text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-display font-bold tracking-tight uppercase">Confirm Delete</h2>
                </div>
                <button onClick={() => setDeletingRecord(null)} className="hover:bg-white/10 p-2 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 text-center">
                <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 mb-2 uppercase tracking-tight">Delete Tax Record?</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                  Are you sure you want to delete the tax record for <span className="font-black text-slate-900">{deletingRecord.plateNumber}</span>? This action cannot be undone.
                </p>
                
                <div className="flex gap-4">
                  <button
                    onClick={() => setDeletingRecord(null)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95"
                  >
                    Delete Now
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
