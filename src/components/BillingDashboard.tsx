import { useEffect, useState, useMemo, FormEvent } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { BillingRecord } from '../types';
import { Receipt, Search, Plus, X, Trash2, Edit2, Download, FileSpreadsheet, Printer, Filter, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Logo from './Logo';

export default function BillingDashboard() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Paid' | 'Pending' | 'Partial'>('all');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);
  const [formData, setFormData] = useState<Partial<BillingRecord>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentStatus: 'Pending',
    paymentMode: 'Cash',
    amount: 0,
    paidAmount: 0,
    pendingAmount: 0
  });

  const [quickFormData, setQuickFormData] = useState<Partial<BillingRecord>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentStatus: 'Pending',
    paymentMode: 'Cash',
    amount: 0,
    paidAmount: 0,
    pendingAmount: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'billing_records'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BillingRecord[];
      setRecords(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = 
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.serviceDescription.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || r.paymentStatus === filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [records, searchTerm, filterStatus]);

  const handleQuickSubmit = async () => {
    if (!quickFormData.customerName || !quickFormData.vehicleNumber || !quickFormData.amount) {
      alert('Please fill in Customer Name, Vehicle Number, and Amount');
      return;
    }

    try {
      const paid = quickFormData.paidAmount || 0;
      const total = quickFormData.amount || 0;
      const status = paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

      await addDoc(collection(db, 'billing_records'), {
        ...quickFormData,
        paymentStatus: status,
        createdAt: new Date().toISOString()
      });
      setQuickFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        amount: 0,
        paidAmount: 0,
        pendingAmount: 0
      });
    } catch (error) {
      console.error('Error saving billing record:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const paid = formData.paidAmount || 0;
      const total = formData.amount || 0;
      const status = paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';

      if (editingRecord) {
        await updateDoc(doc(db, 'billing_records', editingRecord.id!), {
          ...formData,
          paymentStatus: status,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'billing_records'), {
          ...formData,
          paymentStatus: status,
          createdAt: new Date().toISOString()
        });
      }
      setShowAddModal(false);
      setEditingRecord(null);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        paymentStatus: 'Pending',
        paymentMode: 'Cash',
        amount: 0,
        paidAmount: 0,
        pendingAmount: 0
      });
    } catch (error) {
      console.error('Error saving billing record:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await deleteDoc(doc(db, 'billing_records', id));
      } catch (error) {
        console.error('Error deleting account record:', error);
      }
    }
  };

  const exportToExcel = () => {
    const data = filteredRecords.map(r => ({
      'Date': r.date,
      'Customer': r.customerName,
      'Phone': r.phoneNumber,
      'Vehicle': r.vehicleNumber,
      'Service': r.serviceDescription,
      'Total Amount': r.amount,
      'Paid Amount': r.paidAmount,
      'Pending Amount': r.pendingAmount,
      'Mode': r.paymentMode,
      'Notes': r.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Accounts");
    XLSX.writeFile(wb, `Accounts_Report_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-10 bg-modern-blue rounded-full shadow-lg shadow-modern-blue/20" />
          <div>
            <h2 className="text-3xl font-display font-bold text-modern-text tracking-tight uppercase">Accounts Dashboard</h2>
            <p className="text-modern-muted text-[10px] font-black uppercase tracking-[0.3em] mt-1">Arul Jothi Auto Consulting</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={exportToExcel}
            className="px-6 py-4 bg-white border border-modern-border text-modern-muted rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Branding Section */}
      <div className="modern-card rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-modern-blue/5 rounded-full blur-3xl -mr-32 -mt-32 transform group-hover:scale-110 transition-transform duration-1000" />
        <div className="bg-white p-2 rounded-2xl shadow-xl border border-modern-border relative z-10">
          <Logo className="w-16 h-16 object-contain" />
        </div>
        <div className="relative z-10">
          <h1 className="text-2xl font-display font-bold text-modern-text tracking-tight uppercase">
            ARUL JOTHI <span className="text-modern-blue">AUTO CONSULTING</span>
          </h1>
          <p className="text-modern-muted text-[8px] font-black uppercase tracking-[0.4em] mt-1">Professional RTO & Vehicle Services</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 no-print">
        <div className="relative group flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-modern-blue transition-colors" />
          <input
            type="text"
            placeholder="Search records, customers, vehicles..."
            className="w-full pl-14 pr-6 py-4 bg-white border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text shadow-sm placeholder:text-slate-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-6 py-4 bg-white border border-modern-border rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue transition-all shadow-sm text-modern-text"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="all">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Partial">Partial</option>
        </select>
      </div>

      {/* Table */}
      <div className="modern-card rounded-[2.5rem] overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-50 border-b border-modern-border">
              <th className="p-3 text-[9px] font-black text-modern-muted uppercase tracking-widest">Date Info</th>
              <th className="p-3 text-[9px] font-black text-modern-muted uppercase tracking-widest">Customer & Vehicle</th>
              <th className="p-3 text-[9px] font-black text-modern-muted uppercase tracking-widest">Service</th>
              <th className="p-3 text-[9px] font-black text-modern-muted uppercase tracking-widest">Total</th>
              <th className="p-3 text-[9px] font-black text-modern-muted uppercase tracking-widest">Paid</th>
              <th className="p-3 text-[9px] font-black text-modern-muted uppercase tracking-widest">Pending</th>
              <th className="p-3 text-[9px] font-black text-modern-muted uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-modern-border">
            {/* Quick Entry Row */}
            <tr className="bg-modern-blue/5 border-b border-modern-blue/10 no-print">
              <td className="p-4">
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-white border border-modern-border rounded-xl text-[10px] font-bold outline-none focus:border-modern-blue text-modern-text"
                  value={quickFormData.date}
                  onChange={(e) => setQuickFormData({ ...quickFormData, date: e.target.value })}
                />
              </td>
              <td className="p-4">
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Customer Name"
                    className="w-full px-3 py-2 bg-white border border-modern-border rounded-xl text-[10px] font-bold outline-none focus:border-modern-blue text-modern-text placeholder:text-slate-300"
                    value={quickFormData.customerName || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, customerName: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="TN-XX-XXXX"
                    className="w-full px-3 py-2 bg-white border border-modern-border rounded-xl text-[10px] font-black uppercase outline-none focus:border-modern-blue text-modern-text placeholder:text-slate-300"
                    value={quickFormData.vehicleNumber || ''}
                    onChange={(e) => setQuickFormData({ ...quickFormData, vehicleNumber: e.target.value.toUpperCase() })}
                  />
                </div>
              </td>
              <td className="p-4">
                <textarea
                  placeholder="Service Description"
                  className="w-full px-3 py-2 bg-white border border-modern-border rounded-xl text-[10px] font-medium outline-none focus:border-modern-blue text-modern-text placeholder:text-slate-300 min-h-[60px]"
                  value={quickFormData.serviceDescription || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, serviceDescription: e.target.value })}
                />
              </td>
              <td className="p-4">
                <div className="flex flex-col gap-2">
                  <input
                    type="number"
                    placeholder="Total"
                    className="w-full px-3 py-2 bg-white border border-modern-border rounded-xl text-[10px] font-black outline-none focus:border-modern-blue text-modern-text placeholder:text-slate-300"
                    value={quickFormData.amount || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setQuickFormData({ 
                        ...quickFormData, 
                        amount: val,
                        pendingAmount: val - (quickFormData.paidAmount || 0)
                      });
                    }}
                  />
                  <select
                    className="w-full px-3 py-2 bg-white border border-modern-border rounded-xl text-[10px] font-bold outline-none focus:border-modern-blue text-modern-text"
                    value={quickFormData.paymentMode}
                    onChange={(e) => setQuickFormData({ ...quickFormData, paymentMode: e.target.value as any })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </td>
              <td className="p-4">
                <input
                  type="number"
                  placeholder="Paid"
                  className="w-full px-3 py-2 bg-white border border-modern-border rounded-xl text-[10px] font-black outline-none focus:border-modern-blue text-modern-text placeholder:text-slate-300"
                  value={quickFormData.paidAmount || ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setQuickFormData({ 
                      ...quickFormData, 
                      paidAmount: val,
                      pendingAmount: (quickFormData.amount || 0) - val
                    });
                  }}
                />
              </td>
              <td className="p-4">
                <input
                  type="number"
                  placeholder="Pending"
                  className="w-full px-3 py-2 bg-white border border-modern-border rounded-xl text-[10px] font-black outline-none focus:border-modern-blue text-modern-text placeholder:text-slate-300"
                  value={quickFormData.pendingAmount || ''}
                  onChange={(e) => setQuickFormData({ ...quickFormData, pendingAmount: Number(e.target.value) })}
                />
              </td>
              <td className="p-4 text-right">
                <button
                  onClick={handleQuickSubmit}
                  className="px-4 py-3 bg-modern-blue text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-modern-blue/80 transition-all shadow-lg shadow-modern-blue/20"
                >
                  Save Record
                </button>
              </td>
            </tr>

            {loading ? (
              <tr>
                <td colSpan={7} className="p-20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-slate-100 border-t-modern-blue rounded-full animate-spin" />
                    <p className="text-modern-muted text-xs font-bold uppercase tracking-widest">Loading Records...</p>
                  </div>
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-20 text-center">
                  <p className="text-modern-muted text-xs font-bold uppercase tracking-widest">No account records found</p>
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors group h-10">
                  <td className="p-3">
                    <span className="text-[9px] font-bold text-modern-muted uppercase">{format(new Date(record.date), 'dd MMM yyyy')}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-modern-text">{record.customerName}</span>
                      <span className="text-[9px] font-black text-modern-blue uppercase mt-0.5 tracking-wider">{record.vehicleNumber}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-[10px] font-medium text-modern-muted line-clamp-1 max-w-[200px]">{record.serviceDescription}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-modern-text">₹{Number(record.amount).toLocaleString()}</span>
                      <span className="text-[9px] font-bold text-modern-muted uppercase mt-0.5">{record.paymentMode}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-black text-emerald-600">₹{Number(record.paidAmount || 0).toLocaleString()}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-black text-amber-600">₹{Number(record.pendingAmount || 0).toLocaleString()}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingRecord(record);
                          setFormData(record);
                          setShowAddModal(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-modern-blue hover:bg-modern-blue/5 rounded-lg transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(record.id!)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-modern-border"
            >
              <div className="p-8 sm:p-12">
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-modern-blue/5 rounded-2xl text-modern-blue">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display font-bold text-modern-text tracking-tight uppercase">
                        {editingRecord ? 'Edit Account Record' : 'Create New Record'}
                      </h3>
                      <p className="text-modern-muted text-[10px] font-black uppercase tracking-widest mt-1">Enter account details below</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-3 text-slate-400 hover:text-modern-text hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Date</label>
                      <input
                        required
                        type="date"
                        className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text"
                        value={formData.date || ''}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Customer Name</label>
                      <input
                        required
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text placeholder:text-slate-300"
                        placeholder="Customer Name"
                        value={formData.customerName || ''}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Phone Number</label>
                      <input
                        required
                        type="tel"
                        className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text placeholder:text-slate-300"
                        placeholder="WhatsApp Number"
                        value={formData.phoneNumber || ''}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Vehicle Number</label>
                      <input
                        required
                        type="text"
                        className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text placeholder:text-slate-300"
                        placeholder="TN-XX-XXXX"
                        value={formData.vehicleNumber || ''}
                        onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Total Amount (₹)</label>
                      <input
                        required
                        type="number"
                        className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text placeholder:text-slate-300"
                        placeholder="0.00"
                        value={formData.amount || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormData({ 
                            ...formData, 
                            amount: val,
                            pendingAmount: val - (formData.paidAmount || 0)
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Paid Amount (₹)</label>
                      <input
                        required
                        type="number"
                        className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text placeholder:text-slate-300"
                        placeholder="0.00"
                        value={formData.paidAmount || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormData({ 
                            ...formData, 
                            paidAmount: val,
                            pendingAmount: (formData.amount || 0) - val
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Pending Amount (₹)</label>
                      <input
                        required
                        type="number"
                        className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text placeholder:text-slate-300"
                        placeholder="0.00"
                        value={formData.pendingAmount || ''}
                        onChange={(e) => setFormData({ ...formData, pendingAmount: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Service Description</label>
                    <textarea
                      required
                      className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text placeholder:text-slate-300 min-h-[100px]"
                      placeholder="Describe the services provided..."
                      value={formData.serviceDescription || ''}
                      onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Payment Mode</label>
                      <select
                        className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text"
                        value={formData.paymentMode}
                        onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value as any })}
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-5 bg-modern-blue text-white rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-modern-blue/90 transition-all active:scale-95 shadow-lg shadow-modern-blue/20 mt-4"
                  >
                    {editingRecord ? 'Update Account Record' : 'Save Account Record'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
