import { useState } from 'react';
import { FileText, Download, User, Car, Phone, CreditCard, Receipt, Plus, Trash2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Logo from './Logo';

interface ManualBillItem {
  vehicleNo: string;
  servicesDescription: string;
  amount: number;
}

export default function CustomerBillDashboard() {
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    dueDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
    customerName: '',
    phoneNumber: '',
    paidAmount: 0,
    paymentMode: 'Cash' as 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'
  });

  const [items, setItems] = useState<ManualBillItem[]>([
    { vehicleNo: '', servicesDescription: '', amount: 0 }
  ]);

  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const pendingAmount = Math.max(0, totalAmount - formData.paidAmount);

  const addItem = () => {
    setItems([...items, { vehicleNo: '', servicesDescription: '', amount: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ManualBillItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const generatePDF = async () => {
    if (!formData.customerName) {
      alert('Please enter Customer Name');
      return;
    }

    const doc = new jsPDF();
    const invoiceNo = `AI-${Math.random().toString(36).substr(2, 3).toUpperCase()}-001`;
    
    // Colors
    const darkGreen = [45, 90, 39];
    const gold = [241, 196, 15];
    const paleYellow = [254, 249, 231];
    const sageGreen = [169, 196, 173];

    // 1. Top Header Background
    doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.rect(0, 0, 210, 45, 'F');

    // Diagonal Accent
    doc.setFillColor(gold[0], gold[1], gold[2]);
    doc.triangle(60, 0, 100, 0, 120, 45, 'F');
    
    // 2. Logo & Brand Name (Left)
    try {
      const logoUrl = "/LOGO.png";
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = logoUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
      if (img.complete && img.naturalWidth > 0) {
        doc.addImage(img, 'PNG', 20, 10, 22, 22);
      }
    } catch (e) {
      console.error("Logo failed to load for PDF", e);
    }

    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('ARUL JOTHI', 48, 24);
    doc.setFontSize(11);
    doc.text('AUTO CONSULTING', 48, 31);

    // 3. INVOICE Title (Right)
    doc.setTextColor(gold[0], gold[1], gold[2]);
    doc.setFontSize(40);
    doc.text('INVOICE', 140, 25);

    // Invoice Details
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`INVOICE  : ${invoiceNo}`, 140, 35);
    doc.text(`DATE         : ${format(new Date(formData.date), 'dd-MM-yyyy')}`, 140, 40);
    doc.text(`DUE DATE : ${format(new Date(formData.dueDate), 'dd-MM-yyyy')}`, 140, 45);

    // 4. Invoice To Section
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(10);
    doc.text('Invoice To', 20, 65);
    
    doc.setTextColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(formData.customerName, 20, 72);
    // Underline name
    const nameWidth = doc.getTextWidth(formData.customerName);
    doc.setDrawColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.line(20, 73, 20 + nameWidth, 73);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Phone: ${formData.phoneNumber}`, 20, 80);

    // 5. Table
    autoTable(doc, {
      startY: 105,
      head: [['SL', 'Vehicle No', 'Services Description', 'Amount']],
      body: items.map((item, index) => [
        (index + 1).toString().padStart(2, '0'),
        item.vehicleNo,
        item.servicesDescription,
        item.amount.toLocaleString()
      ]),
      headStyles: { 
        fillColor: darkGreen as any, 
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        textColor: [0, 0, 0],
        halign: 'center'
      },
      columnStyles: {
        1: { halign: 'left' },
        2: { halign: 'left' }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.row.index % 2 === 0) {
            data.cell.styles.fillColor = paleYellow as any;
          } else {
            data.cell.styles.fillColor = sageGreen as any;
          }
        }
      },
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.1,
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;

    // 6. Totals
    doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.rect(135, finalY, 60, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('SUB TOTAL =', 140, finalY + 7);
    doc.text('TOTAL          =', 140, finalY + 15);
    doc.text(totalAmount.toLocaleString(), 190, finalY + 7, { align: 'right' });
    doc.text(totalAmount.toLocaleString(), 190, finalY + 15, { align: 'right' });

    // 7. Payment Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Info', 20, finalY + 10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment Mode : ${formData.paymentMode}`, 20, finalY + 17);

    // 8. Bottom Bar
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(darkGreen[0], darkGreen[1], darkGreen[2]);
    doc.rect(0, pageHeight - 15, 210, 15, 'F');
    doc.setDrawColor(gold[0], gold[1], gold[2]);
    doc.setLineWidth(1);
    doc.line(0, pageHeight - 15, 210, pageHeight - 15);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('012-345-678', 35, pageHeight - 7);
    doc.text('Your Email Here', 75, pageHeight - 7);
    doc.text('Your Site Here', 120, pageHeight - 7);
    doc.text('Adress Line 01', 165, pageHeight - 7);

    doc.save(`Invoice_${formData.customerName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Logo className="w-16 h-16 object-contain rounded-xl shadow-lg bg-white p-1" />
          <div>
            <h2 className="text-3xl font-display font-bold text-modern-text tracking-tight uppercase">Arul Jothi</h2>
            <p className="text-modern-muted text-[10px] font-black uppercase tracking-[0.3em] mt-1">Auto Consulting</p>
          </div>
        </div>
        <button
          onClick={generatePDF}
          className="px-8 py-5 bg-modern-blue text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-modern-blue/90 transition-all flex items-center gap-3 shadow-lg shadow-modern-blue/20 active:scale-95"
        >
          <Download className="w-5 h-5" />
          Generate PDF Bill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Customer Details Card */}
        <div className="modern-card rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-modern-blue/5 rounded-full blur-2xl -mr-16 -mt-16 transform group-hover:scale-110 transition-transform duration-1000" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-modern-blue/5 rounded-2xl text-modern-blue">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-modern-text uppercase tracking-widest">Customer Details</h3>
              <p className="text-[10px] text-modern-muted font-bold uppercase tracking-widest mt-0.5">Enter client information</p>
            </div>
          </div>

          <div className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Date</label>
              <input
                type="date"
                className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Customer Name</label>
              <input
                type="text"
                placeholder="Enter customer name"
                className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text placeholder:text-slate-300"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Phone Number</label>
              <input
                type="tel"
                placeholder="Enter phone"
                className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text placeholder:text-slate-300"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Payment Details Card */}
        <div className="modern-card rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-modern-blue/5 rounded-full blur-2xl -mr-16 -mt-16 transform group-hover:scale-110 transition-transform duration-1000" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-modern-blue/5 rounded-2xl text-modern-blue">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-modern-text uppercase tracking-widest">Payment Info</h3>
              <p className="text-[10px] text-modern-muted font-bold uppercase tracking-widest mt-0.5">Manage transaction details</p>
            </div>
          </div>

          <div className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-modern-muted uppercase tracking-widest ml-1">Paid Amount (₹)</label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-black text-modern-text placeholder:text-slate-300"
                value={formData.paidAmount || ''}
                onChange={(e) => setFormData({ ...formData, paidAmount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-6">
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
            
            <div className="pt-8 mt-4 border-t border-modern-border grid grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-modern-border">
                <p className="text-[10px] font-black text-modern-muted uppercase tracking-widest mb-1">Total Amount</p>
                <p className="text-2xl font-black text-modern-text">₹{totalAmount.toLocaleString()}</p>
              </div>
              <div className="p-6 bg-modern-blue/5 rounded-3xl border border-modern-blue/10">
                <p className="text-[10px] font-black text-modern-blue uppercase tracking-widest mb-1">Pending</p>
                <p className="text-2xl font-black text-modern-blue transition-all">₹{pendingAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Items Card */}
      <div className="modern-card rounded-[2.5rem] p-10 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-modern-blue/5 rounded-2xl text-modern-blue">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-modern-text uppercase tracking-widest">Service Items</h3>
              <p className="text-[10px] text-modern-muted font-bold uppercase tracking-widest mt-0.5">Add services provided</p>
            </div>
          </div>
          <button
            onClick={addItem}
            className="flex items-center gap-2 px-6 py-3 bg-modern-blue text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-modern-blue/90 transition-all shadow-lg shadow-modern-blue/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add New Item
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-4 group p-2 hover:bg-slate-50 rounded-3xl transition-all">
              <div className="w-40">
                <input
                  type="text"
                  placeholder="Vehicle No"
                  className="w-full px-4 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text text-sm placeholder:text-slate-300"
                  value={item.vehicleNo}
                  onChange={(e) => updateItem(index, 'vehicleNo', e.target.value)}
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Services description"
                  className="w-full px-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-bold text-modern-text text-sm placeholder:text-slate-300"
                  value={item.servicesDescription}
                  onChange={(e) => updateItem(index, 'servicesDescription', e.target.value)}
                />
              </div>
              <div className="w-40">
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-black text-sm">₹</span>
                  <input
                    type="number"
                    placeholder="Amount"
                    className="w-full pl-10 pr-6 py-4 bg-slate-50 border border-modern-border rounded-2xl focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-black text-modern-text text-sm placeholder:text-slate-300"
                    value={item.amount || ''}
                    onChange={(e) => updateItem(index, 'amount', Number(e.target.value))}
                  />
                </div>
              </div>
              <button
                onClick={() => removeItem(index)}
                className="p-4 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                title="Remove Item"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
