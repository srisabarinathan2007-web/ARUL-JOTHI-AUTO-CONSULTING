import { useState } from 'react';
import { Printer, Plus, Trash2, User, Hash } from 'lucide-react';
import { format } from 'date-fns';
import Logo from './Logo';

interface ManualTaxRow {
  id: string;
  vehicleNo: string;
  taxAmount: string;
  gt: string;
}

export default function TaxReportDashboard() {
  const [customerName, setCustomerName] = useState('');
  const [rows, setRows] = useState<ManualTaxRow[]>([
    { id: '1', vehicleNo: '', taxAmount: '', gt: '' }
  ]);

  const addRow = () => {
    setRows([...rows, { id: Math.random().toString(36).substr(2, 9), vehicleNo: '', taxAmount: '', gt: '' }]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(rows.filter(r => r.id !== id));
    }
  };

  const updateRow = (id: string, field: keyof ManualTaxRow, value: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const calculateTotal = () => {
    return rows.reduce((sum, r) => {
      const tax = parseFloat(r.taxAmount) || 0;
      const gtValue = parseFloat(r.gt) || 0;
      return sum + tax + gtValue;
    }, 0).toFixed(2);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8">
      {/* Configuration Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-10 bg-amber-500 rounded-full shadow-lg shadow-amber-500/20" />
          <div>
            <h2 className="text-3xl font-display font-bold text-modern-text tracking-tight uppercase">Custom Tax Report</h2>
            <p className="text-modern-muted text-[10px] font-black uppercase tracking-[0.3em] mt-1">
              Manually type details to generate a print-ready report
            </p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="bg-modern-blue text-white px-8 py-4 rounded-2xl shadow-lg shadow-modern-blue/20 hover:bg-modern-blue/80 transition-all active:scale-95 flex items-center gap-2 "
        >
          <Printer className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">Print Report</span>
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Editor Sidebar */}
        <div className="xl:w-96 space-y-6 no-print">
          <div className="modern-card p-6 rounded-[2rem]">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <User className="w-4 h-4" /> Report Header
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest mb-2 block">Customer Name</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-slate-50 border border-modern-border rounded-xl focus:ring-2 focus:ring-modern-blue outline-none transition-all font-bold"
                  placeholder="ENTER CUSTOMER NAME"
                />
              </div>
            </div>
          </div>

          <div className="modern-card p-6 rounded-[2rem]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Hash className="w-4 h-4" /> Manage Rows
              </h3>
              <button
                onClick={addRow}
                className="bg-emerald-500 text-white p-2 rounded-lg hover:bg-emerald-600 transition-colors"
                title="Add Row"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {rows.map((row, index) => (
                <div key={row.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 relative group">
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Row #{index + 1}</span>
                    <button 
                      onClick={() => removeRow(row.id)}
                      className="text-rose-500 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    value={row.vehicleNo}
                    onChange={(e) => updateRow(row.id, 'vehicleNo', e.target.value.toUpperCase())}
                    placeholder="Vehicle Number"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={row.taxAmount}
                      onChange={(e) => updateRow(row.id, 'taxAmount', e.target.value)}
                      placeholder="Amount"
                      type="number"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                    />
                    <input
                      value={row.gt}
                      onChange={(e) => updateRow(row.id, 'gt', e.target.value.toUpperCase())}
                      placeholder="GT"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="flex-1">
          <div className="print-container">
            <div className="modern-card p-10 rounded-[2.5rem] bg-white relative overflow-hidden print:p-0 print:border-none print:shadow-none min-h-[11in]">
              {/* Report Header */}
              <div className="flex flex-col items-center justify-center text-center mb-10">
                <div className="flex items-center gap-3 mb-6 no-print">
                   <Logo className="w-10 h-10 object-contain" />
                   <h2 className="text-xl font-display font-bold text-modern-text tracking-tight uppercase">ARUL JOTHI AUTO CONSULTING</h2>
                </div>
                
                <div className="border-4 border-slate-900 px-12 py-5 rounded-2xl mb-4 inline-block bg-slate-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                  <h1 className="text-4xl print:text-6xl font-display font-black text-white uppercase tracking-tighter">
                    {customerName || 'CUSTOMER NAME'}
                  </h1>
                </div>

                <div className="flex items-center gap-4 w-full max-w-lg mb-8">
                  <div className="flex-1 h-px bg-slate-200" />
                  <p className="text-[11px] print:text-xs font-black text-modern-muted uppercase tracking-[0.5em] whitespace-nowrap">CONSOLIDATED TAX REPORT</p>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse border-2 border-slate-900">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-900">
                      <th className="p-4 border-r-2 border-slate-900 text-xs font-black uppercase tracking-widest text-slate-900 w-20 text-center">S.No</th>
                      <th className="p-4 border-r-2 border-slate-900 text-xs font-black uppercase tracking-widest text-slate-900">Vehicle No</th>
                      <th className="p-4 border-r-2 border-slate-900 text-xs font-black uppercase tracking-widest text-slate-900 w-48 text-center">Tax Amount</th>
                      <th className="p-4 text-xs font-black uppercase tracking-widest text-slate-900 w-44 text-center">GT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {rows.map((row, index) => (
                      <tr key={row.id} className="border-b border-slate-900 hover:bg-slate-50 transition-colors">
                        <td className="p-4 border-r-2 border-slate-900 text-sm font-bold text-slate-900 text-center">{index + 1}</td>
                        <td className="p-4 border-r-2 border-slate-900 text-sm font-black text-slate-900 uppercase">{row.vehicleNo || '---'}</td>
                        <td className="p-4 border-r-2 border-slate-900 text-sm font-bold text-slate-900 text-center">
                          {row.taxAmount ? `₹${row.taxAmount}` : '---'}
                        </td>
                        <td className="p-4 text-sm font-black text-slate-900 text-center uppercase">{row.gt || '---'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-900">
                      <td colSpan={2} className="p-4 border-r-2 border-slate-900 text-xs font-black uppercase tracking-widest text-right">Total Amount:</td>
                      <td className="p-4 border-r-2 border-slate-900 text-sm font-black text-slate-900 text-center">
                        ₹{calculateTotal()}
                      </td>
                      <td className="p-4 text-[10px] font-bold text-modern-muted italic text-center uppercase"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Print Footer */}
              <div className="mt-12 hidden print:flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Generated On</p>
                  <p className="text-xs font-bold text-slate-900">{format(new Date(), 'dd MMM yyyy, hh:mm a')}</p>
                </div>
                <div className="text-right">
                  <div className="w-48 h-px bg-slate-400 mb-2" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
            margin: 0;
            padding: 0;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}
