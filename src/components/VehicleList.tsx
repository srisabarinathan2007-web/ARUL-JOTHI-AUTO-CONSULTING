import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, doc, updateDoc, where, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Vehicle } from '../types';
import { Edit2, MessageSquare, Search, AlertTriangle, CheckCircle2, Phone, LayoutGrid, List, Eye, ChevronRight, Car, RefreshCw, Loader2, ArrowUpAz, ArrowDownAz, X, Trash2, Plus, Check, Download, Printer, ExternalLink } from 'lucide-react';
import ExpiryBadge from './ExpiryBadge';
import { sendWhatsAppReminder, checkWhatsAppNumber } from '../services/whatsappService';
import { syncVehicleWithApi } from '../services/vahanService';
import { cn } from '../lib/utils';
import { format, isBefore, differenceInDays, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import Logo from './Logo';
import { motion, AnimatePresence } from 'motion/react';

interface VehicleListProps {
  onEdit?: (vehicle: Vehicle) => void;
  onViewDetails: (vehicle: Vehicle) => void;
  onVehiclesChange?: (vehicles: Vehicle[]) => void;
  userVehicleNumber?: string;
  isAdmin?: boolean;
  initialExpiryFilter?: 'all' | 'expired' | '0' | '1' | '7' | '15' | '30' | 'month' | 'nextMonth';
  vehicles?: Vehicle[];
  loading?: boolean;
  onImport?: () => void;
  reminderDays?: number;
}

export default function VehicleList({ 
  onEdit, 
  onViewDetails, 
  onVehiclesChange, 
  userVehicleNumber, 
  isAdmin,
  initialExpiryFilter = 'all',
  vehicles: propVehicles,
  loading: propLoading,
  onImport,
  reminderDays = 15
}: VehicleListProps) {
  const [internalVehicles, setInternalVehicles] = useState<Vehicle[]>([]);
  const [internalLoading, setInternalLoading] = useState(true);

  const vehicles = propVehicles ?? internalVehicles;
  const loading = propLoading ?? internalLoading;

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(isAdmin ? 'table' : 'grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortBy, setSortBy] = useState<'plateNumber' | 'fcExpiry'>('plateNumber');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expired' | '0' | '1' | '7' | '15' | '30' | 'month' | 'nextMonth'>(initialExpiryFilter);
  const [documentFilter, setDocumentFilter] = useState<'all' | 'fc' | 'permit' | 'insurance' | 'nationalPermit'>('all');
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    plateNumber: '',
    ownerName: '',
    phoneNumber: '',
    fcExpiry: '',
    permitExpiry: '',
    insuranceExpiry: '',
    nationalPermitExpiry: ''
  });
  const [editData, setEditData] = useState<Partial<Vehicle>>({});

  useEffect(() => {
    setExpiryFilter(initialExpiryFilter);
  }, [initialExpiryFilter]);

  const handleExportExcel = () => {
    const exportData = filteredVehicles.map((v, index) => {
      // Determine which document is expiring
      const documents = [
        { name: 'FC', date: v.fcExpiry },
        { name: 'Permit', date: v.permitExpiry },
        { name: 'Insurance', date: v.insuranceExpiry },
        { name: 'National Permit', date: v.nationalPermitExpiry }
      ];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find documents that are expired or expiring within 30 days
      const expiringDocs = documents
        .filter(doc => {
          if (!doc.date) return false;
          const expiryDate = new Date(doc.date);
          return isBefore(expiryDate, today) || differenceInDays(expiryDate, today) <= 30;
        })
        .map(doc => doc.name);

      // If no document is specifically expiring soon, show the earliest one
      let documentStatus = expiringDocs.join(', ');
      if (!documentStatus) {
        const validDocs = documents.filter(d => d.date).sort((a, b) => 
          new Date(a.date!).getTime() - new Date(b.date!).getTime()
        );
        if (validDocs.length > 0) {
          documentStatus = validDocs[0].name;
        } else {
          documentStatus = 'N/A';
        }
      }

      return {
        'S.NO': index + 1,
        'VECHICLE NUMBER': v.plateNumber,
        'OWNER NAME': v.ownerName,
        'PHONE NUMBER': v.phoneNumber,
        'WHAT DOCUMENT IS EXPIRY': documentStatus,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vehicles");
    
    const fileName = `Arul_Jothi_Vehicle_Report_${documentFilter}_${expiryFilter}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handlePrint = () => {
    window.focus();
    window.print();
  };

  useEffect(() => {
    let q = query(collection(db, 'vehicles'));
    
    if (userVehicleNumber) {
      q = query(collection(db, 'vehicles'), where('plateNumber', '==', userVehicleNumber));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vehicleData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Vehicle[];
      
      if (!propVehicles) {
        setInternalVehicles(vehicleData);
        setInternalLoading(false);
      }
      
      onVehiclesChange?.(vehicleData);
    });
    return () => unsubscribe();
  }, [onVehiclesChange, userVehicleNumber]);

  const handleAddVehicle = async () => {
    if (!newVehicle.plateNumber || !newVehicle.ownerName || !newVehicle.phoneNumber) {
      alert('Please fill in vehicle number, owner name, and phone number.');
      return;
    }

    setActionLoading(true);
    try {
      await addDoc(collection(db, 'vehicles'), {
        ...newVehicle,
        plateNumber: newVehicle.plateNumber.toUpperCase(),
        createdAt: new Date().toISOString()
      });
      setNewVehicle({
        plateNumber: '',
        ownerName: '',
        phoneNumber: '',
        fcExpiry: '',
        permitExpiry: '',
        insuranceExpiry: '',
        nationalPermitExpiry: ''
      });
    } catch (error) {
      console.error('Error adding vehicle:', error);
      alert('Failed to add vehicle. Please check your connection.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateVehicle = async (id: string) => {
    if (!editData.plateNumber || !editData.ownerName || !editData.phoneNumber) {
      alert('Please fill in vehicle number, owner name, and phone number.');
      return;
    }

    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'vehicles', id), {
        ...editData,
        plateNumber: editData.plateNumber.toUpperCase()
      });
      setEditingId(null);
      setEditData({});
    } catch (error) {
      console.error('Error updating vehicle:', error);
      alert('Failed to update vehicle. Please check your connection.');
    } finally {
      setActionLoading(false);
    }
  };

  const startEditing = (vehicle: Vehicle) => {
    setEditingId(vehicle.id || null);
    setEditData(vehicle);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleDelete = async (vehicle: Vehicle) => {
    setDeletingVehicle(vehicle);
  };

  const confirmDelete = async () => {
    if (!deletingVehicle?.id) return;
    try {
      await deleteDoc(doc(db, 'vehicles', deletingVehicle.id));
      setDeletingVehicle(null);
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('Failed to delete vehicle. Please check your connection.');
    }
  };

  const handleSendReminder = async (vehicle: Vehicle, type: string, date: string) => {
    // Validate WhatsApp number before sending
    const waCheck = await checkWhatsAppNumber(vehicle.phoneNumber);
    if (!waCheck.isValid) {
      alert(waCheck.error || 'This is not a registered WhatsApp number.');
      return;
    }

    const result = await sendWhatsAppReminder(
      vehicle.phoneNumber,
      vehicle.ownerName,
      vehicle.plateNumber,
      type,
      date
    );
    
    // Update last reminder sent timestamp
    if (vehicle.id) {
      await updateDoc(doc(db, 'vehicles', vehicle.id), {
        lastReminderSent: new Date().toISOString()
      });
    }

    // Open WhatsApp only if not automated
    if (!result.automated && result.url) {
      window.open(result.url, '_blank');
    } else if (result.automated) {
      alert('Message sent automatically via WhatsApp API!');
    }
  };

  const filteredVehicles = vehicles
    .filter(v => {
      const matchesSearch = v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           v.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Determine which dates to consider based on the document filter
      let datesToCheck: (string | undefined)[] = [];
      if (documentFilter === 'fc') datesToCheck = [v.fcExpiry];
      else if (documentFilter === 'permit') datesToCheck = [v.permitExpiry];
      else if (documentFilter === 'insurance') datesToCheck = [v.insuranceExpiry];
      else if (documentFilter === 'nationalPermit') datesToCheck = [v.nationalPermitExpiry];
      else datesToCheck = [v.fcExpiry, v.permitExpiry, v.insuranceExpiry, v.nationalPermitExpiry];

      const validDates = datesToCheck.filter(Boolean).map(d => new Date(d!));
      
      // If no dates exist for the selected document type, only show if no expiry filter is active
      if (validDates.length === 0) return expiryFilter === 'all';

      // Find the earliest relevant expiry date for this vehicle
      const earliestDate = new Date(Math.min(...validDates.map(d => d.getTime())));
      const diffDays = differenceInDays(earliestDate, today);

      // Apply mutually exclusive filters so a vehicle appears in exactly one bucket
      if (expiryFilter === 'all') return true;
      
      if (expiryFilter === 'month') {
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        return earliestDate >= start && earliestDate <= end;
      }

      if (expiryFilter === 'nextMonth') {
        const nextMonth = addMonths(today, 1);
        const start = startOfMonth(nextMonth);
        const end = endOfMonth(nextMonth);
        return earliestDate >= start && earliestDate <= end;
      }

      if (expiryFilter === 'expired') return diffDays < 0;
      if (expiryFilter === '0') return diffDays === 0;
      if (expiryFilter === '1') return diffDays === 1;
      if (expiryFilter === '7') return diffDays >= 2 && diffDays <= 7;
      if (expiryFilter === '15') return diffDays >= 8 && diffDays <= 15;
      if (expiryFilter === '30') return diffDays >= 16 && diffDays <= 30;

      return false;
    })
    .sort((a, b) => {
      if (sortBy === 'plateNumber') {
        const getPlateParts = (plate: string) => {
          // Clean the plate number (remove spaces/dashes)
          const cleanPlate = plate.replace(/[^A-Z0-9]/g, '').toUpperCase();
          
          // Regex to match: [State(2 chars)][District(digits)][Series(chars)][Number(digits)]
          // Example: TN 59 CP 4114 -> TN, 59, CP, 4114
          const match = cleanPlate.match(/^([A-Z]{2})(\d{1,2})([A-Z]*)(\d+)$/);
          
          if (match) {
            return {
              state: match[1],
              district: parseInt(match[2], 10),
              series: match[3],
              number: parseInt(match[4], 10)
            };
          }
          
          // Fallback for non-standard formats
          return { state: cleanPlate, district: 0, series: '', number: 0 };
        };

        const partA = getPlateParts(a.plateNumber);
        const partB = getPlateParts(b.plateNumber);

        // Sort Hierarchy: State -> District -> Series -> Number
        if (partA.state !== partB.state) {
          return sortOrder === 'asc' ? partA.state.localeCompare(partB.state) : partB.state.localeCompare(partA.state);
        }
        if (partA.district !== partB.district) {
          return sortOrder === 'asc' ? partA.district - partB.district : partB.district - partA.district;
        }
        if (partA.series !== partB.series) {
          return sortOrder === 'asc' ? partA.series.localeCompare(partB.series) : partB.series.localeCompare(partA.series);
        }
        return sortOrder === 'asc' ? partA.number - partB.number : partB.number - partA.number;
      } else {
        const getEarliestExpiry = (v: Vehicle) => {
          const dates = [
            v.fcExpiry,
            v.permitExpiry,
            v.insuranceExpiry,
            v.nationalPermitExpiry
          ].filter(Boolean).map(d => new Date(d!).getTime());
          
          return dates.length > 0 ? Math.min(...dates) : Infinity;
        };

        const dateA = getEarliestExpiry(a);
        const dateB = getEarliestExpiry(b);
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });

  const getExpiryStatus = (date?: string) => {
    if (!date) return 'none';
    const expiryDate = new Date(date);
    const today = new Date();
    if (isBefore(expiryDate, today)) return 'expired';
    if (differenceInDays(expiryDate, today) <= reminderDays) return 'soon';
    return 'valid';
  };

  const getEarliestExpiryInfo = (v: Vehicle) => {
    const documents = [
      { type: 'FC', date: v.fcExpiry },
      { type: 'Permit', date: v.permitExpiry },
      { type: 'Insurance', date: v.insuranceExpiry },
      { type: 'National Permit', date: v.nationalPermitExpiry }
    ].filter(doc => !!doc.date);
    
    if (documents.length === 0) return { type: 'Document', date: '' };
    
    return documents.reduce((prev, curr) => {
      return new Date(curr.date!).getTime() < new Date(prev.date!).getTime() ? curr : prev;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-modern-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Print Only Header */}
      <div className="hidden print:block mb-2 border-b border-slate-900 pb-1 print-only-header relative">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-3 mb-0.5">
            <Logo className="w-8 h-8 object-contain" />
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Arul Jothi Auto Consulting</h1>
          </div>
          <p className="text-slate-900 font-black uppercase tracking-[0.3em] text-[11px]">VEHICLE DETAILS</p>
        </div>
        
        <div className="absolute top-0 right-0 text-right">
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Report Generated</p>
          <p className="text-[9px] font-bold text-slate-900">{format(new Date(), 'dd MMM yyyy')} • {format(new Date(), 'hh:mm a')}</p>
        </div>

        <div className="mt-1 flex justify-center gap-3">
          <div className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Time Filter</p>
            <p className="text-[9px] font-bold text-slate-900 uppercase">{expiryFilter === 'all' ? 'Any Time' : expiryFilter}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Document Type</p>
            <p className="text-[9px] font-bold text-slate-900 uppercase">{documentFilter === 'all' ? 'All Documents' : documentFilter}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Total Records</p>
            <p className="text-[9px] font-bold text-slate-900">{filteredVehicles.length} Vehicles</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap gap-2 no-print">
              {(() => {
                const counts = vehicles.reduce((acc, v) => {
                  const matchesSearch = v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                       v.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
                  if (!matchesSearch) return acc;

                  acc.all++;
                  if (v.fcExpiry) acc.fc++;
                  if (v.permitExpiry) acc.permit++;
                  if (v.insuranceExpiry) acc.insurance++;
                  if (v.nationalPermitExpiry) acc.nationalPermit++;
                  return acc;
                }, { all: 0, fc: 0, permit: 0, insurance: 0, nationalPermit: 0 });

                return [
                  { id: 'all', label: 'All Docs', count: counts.all },
                  { id: 'fc', label: 'FC', count: counts.fc },
                  { id: 'permit', label: 'Permit', count: counts.permit },
                  { id: 'insurance', label: 'Insurance', count: counts.insurance },
                  { id: 'nationalPermit', label: 'Nat. Permit', count: counts.nationalPermit },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setDocumentFilter(filter.id as any)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2",
                      documentFilter === filter.id 
                        ? "bg-modern-blue text-modern-text border-modern-blue shadow-lg shadow-modern-blue/20" 
                        : "bg-white text-modern-muted border-modern-border hover:border-modern-blue/30 hover:text-modern-text"
                    )}
                  >
                    {filter.label}
                    <span className={cn(
                      "ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-black",
                      documentFilter === filter.id 
                        ? "bg-white/20 text-white" 
                        : "bg-slate-100 text-slate-500"
                    )}>
                      {filter.count}
                    </span>
                  </button>
                ));
              })()}
            </div>

            <div className="flex gap-3 no-print">
              {onImport && (
                <button
                  onClick={onImport}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Bulk Import
                </button>
              )}
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-white border border-modern-border hover:border-emerald-500/50 hover:bg-emerald-50 text-modern-muted hover:text-emerald-600 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-white border border-modern-border hover:border-modern-blue/30 text-modern-muted hover:text-modern-text px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 no-print">
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              
              const counts = vehicles.reduce((acc, v) => {
                const matchesSearch = v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                     v.ownerName.toLowerCase().includes(searchTerm.toLowerCase());
                
                if (!matchesSearch) return acc;

                let datesToCheck: (string | undefined)[] = [];
                if (documentFilter === 'fc') datesToCheck = [v.fcExpiry];
                else if (documentFilter === 'permit') datesToCheck = [v.permitExpiry];
                else if (documentFilter === 'insurance') datesToCheck = [v.insuranceExpiry];
                else if (documentFilter === 'nationalPermit') datesToCheck = [v.nationalPermitExpiry];
                else datesToCheck = [v.fcExpiry, v.permitExpiry, v.insuranceExpiry, v.nationalPermitExpiry];

                const validDates = datesToCheck.filter(Boolean).map(d => new Date(d!));
                
                acc.all++;
                if (validDates.length === 0) return acc;

                const earliestDate = new Date(Math.min(...validDates.map(d => d.getTime())));
                const diffDays = differenceInDays(earliestDate, today);

                if (diffDays < 0) acc.expired++;
                if (diffDays === 0) acc['0']++;
                if (diffDays === 1) acc['1']++;
                if (diffDays >= 2 && diffDays <= 7) acc['7']++;
                if (diffDays >= 8 && diffDays <= 15) acc['15']++;
                if (diffDays >= 16 && diffDays <= 30) acc['30']++;

                const start = startOfMonth(today);
                const end = endOfMonth(today);
                if (earliestDate >= start && earliestDate <= end) acc.month++;

                const nextMonth = addMonths(today, 1);
                const nStart = startOfMonth(nextMonth);
                const nEnd = endOfMonth(nextMonth);
                if (earliestDate >= nStart && earliestDate <= nEnd) acc.nextMonth++;

                return acc;
              }, { all: 0, expired: 0, '0': 0, '1': 0, '7': 0, '15': 0, '30': 0, month: 0, nextMonth: 0 });

              return [
                { id: 'all', label: 'Any Time', count: counts.all },
                { id: 'expired', label: 'Expired', count: counts.expired },
                { id: '0', label: 'Today', count: counts['0'] },
                { id: '1', label: '1 Day', count: counts['1'] },
                { id: '7', label: '7 Days', count: counts['7'] },
                { id: '15', label: '15 Days', count: counts['15'] },
                { id: '30', label: '30 Days', count: counts['30'] },
                { id: 'month', label: 'This Month', count: counts.month },
                { id: 'nextMonth', label: 'Next Month', count: counts.nextMonth },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setExpiryFilter(filter.id as any)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2",
                    expiryFilter === filter.id 
                      ? "bg-modern-blue text-modern-text border-modern-blue shadow-lg shadow-modern-blue/20" 
                      : "bg-white text-modern-muted border-modern-border hover:border-modern-blue/30 hover:text-modern-text"
                  )}
                >
                  {filter.label}
                  <span className={cn(
                    "ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    expiryFilter === filter.id 
                      ? "bg-white/20 text-white" 
                      : "bg-slate-100 text-slate-500"
                  )}>
                    {filter.count}
                  </span>
                </button>
              ));
            })()}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        {isAdmin && (
          <div className="relative group flex-1 w-full no-print">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-modern-blue transition-colors" />
            <input
              placeholder="Search by vehicle number or owner name..."
              className="w-full pl-14 pr-6 py-5 bg-white border border-modern-border rounded-[2rem] shadow-sm focus:ring-4 focus:ring-modern-blue/5 focus:border-modern-blue outline-none transition-all font-medium text-modern-text placeholder:text-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {isAdmin && (
          <div className="flex gap-4 no-print">
            <div className="flex p-2 bg-white border border-modern-border rounded-2xl shadow-sm">
              <button
                onClick={() => {
                  if (sortBy === 'plateNumber') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('plateNumber');
                    setSortOrder('asc');
                  }
                }}
                className={cn(
                  "p-3 rounded-xl transition-all flex items-center gap-2",
                  sortBy === 'plateNumber' ? "bg-modern-blue/5 text-modern-blue shadow-sm" : "text-slate-400 hover:text-modern-text"
                )}
                title="Sort by Vehicle Number"
              >
                {sortBy === 'plateNumber' ? (sortOrder === 'asc' ? <ArrowUpAz className="w-5 h-5" /> : <ArrowDownAz className="w-5 h-5" />) : <ArrowUpAz className="w-5 h-5" />}
                <span className="text-xs font-black uppercase tracking-widest">Plate</span>
              </button>
              <button
                onClick={() => {
                  if (sortBy === 'fcExpiry') {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('fcExpiry');
                    setSortOrder('asc');
                  }
                }}
                className={cn(
                  "p-3 rounded-xl transition-all flex items-center gap-2",
                  sortBy === 'fcExpiry' ? "bg-modern-blue/5 text-modern-blue shadow-sm" : "text-slate-400 hover:text-modern-text"
                )}
                title="Sort by FC Expiry"
              >
                {sortBy === 'fcExpiry' ? (sortOrder === 'asc' ? <ArrowUpAz className="w-5 h-5" /> : <ArrowDownAz className="w-5 h-5" />) : <ArrowUpAz className="w-5 h-5" />}
                <span className="text-xs font-black uppercase tracking-widest">FC</span>
              </button>
            </div>

            <div className="flex p-2 bg-white border border-modern-border rounded-2xl shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-3 rounded-xl transition-all",
                  viewMode === 'grid' ? "bg-modern-blue/5 text-modern-blue shadow-sm" : "text-slate-400 hover:text-modern-text"
                )}
                title="Grid View"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  "p-3 rounded-xl transition-all",
                  viewMode === 'table' ? "bg-modern-blue/5 text-modern-blue shadow-sm" : "text-slate-400 hover:text-modern-text"
                )}
                title="Table View"
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="print-container">
        {filteredVehicles.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[2rem] border-2 border-dashed border-modern-border shadow-sm">
          <div className="bg-modern-blue/5 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="text-slate-300 w-10 h-10" />
          </div>
          <p className="text-modern-muted font-bold text-lg">No vehicles found.</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your search or add a new vehicle.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredVehicles.map((vehicle, index) => (
            <div 
              key={vehicle.id} 
              onClick={() => onViewDetails(vehicle)}
              className="modern-card overflow-hidden hover:border-modern-blue/30 group cursor-pointer active:scale-[0.98] flex flex-col relative"
            >
              {/* Serial Number Badge */}
              <div className="absolute top-6 left-6 z-10 bg-modern-blue text-modern-text text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg shadow-lg shadow-modern-blue/20">
                {index + 1}
              </div>
              <div className="p-8 flex-1">
                <div className="flex justify-between items-start mb-8">
                  <div className="pl-10">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-modern-blue rounded-full" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Vehicle Unit</span>
                    </div>
                    <h3 className="text-2xl font-display font-bold text-modern-text tracking-tight leading-none group-hover:text-modern-blue transition-all">{vehicle.plateNumber}</h3>
                    <p className="text-sm font-bold mt-2 uppercase tracking-widest opacity-70 truncate max-w-[180px] text-modern-muted">{vehicle.ownerName}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => onEdit(vehicle)} className="p-2 text-slate-400 hover:text-modern-blue hover:bg-modern-blue/5 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(vehicle)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  <ExpiryBadge label="FC" date={vehicle.fcExpiry || ''} reminderDays={reminderDays} />
                  <ExpiryBadge label="Permit" date={vehicle.permitExpiry || ''} reminderDays={reminderDays} />
                  <ExpiryBadge label="Insurance" date={vehicle.insuranceExpiry || ''} reminderDays={reminderDays} />
                  <ExpiryBadge label="Nat. Permit" date={vehicle.nationalPermitExpiry || ''} reminderDays={reminderDays} />
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-modern-border">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-modern-blue/5 transition-colors">
                      <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-modern-blue" />
                    </div>
                    <span className="text-xs font-black text-modern-muted tracking-wider">{vehicle.phoneNumber}</span>
                  </div>
                  {isAdmin && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const info = getEarliestExpiryInfo(vehicle);
                        handleSendReminder(vehicle, info.type, info.date || '');
                      }}
                      className="flex items-center gap-2 bg-modern-blue hover:bg-modern-blue/90 text-modern-text px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-modern-blue/10"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Remind
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="modern-card overflow-hidden">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left border-collapse table-fixed print:min-w-0">
              <thead className="print:static">
                <tr className="bg-slate-50 border-b border-modern-border print:bg-slate-50">
                  <th className="px-4 py-3 print:p-1 text-[11px] print:text-[8px] font-black uppercase tracking-widest text-modern-muted w-16">S.No</th>
                  <th 
                    className="px-4 py-3 print:p-1 text-[11px] print:text-[8px] font-black uppercase tracking-widest text-modern-muted cursor-pointer hover:text-modern-blue transition-colors w-40"
                    onClick={() => {
                      if (sortBy === 'plateNumber') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('plateNumber');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      Vehicle No
                      {sortBy === 'plateNumber' && (sortOrder === 'asc' ? <ArrowUpAz className="w-3 h-3" /> : <ArrowDownAz className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-4 py-3 print:p-1 text-[11px] print:text-[8px] font-black uppercase tracking-widest text-modern-muted w-48">Owner Name</th>
                  
                  {(documentFilter === 'all' || documentFilter === 'fc') && (
                    <th 
                      className="px-4 py-3 print:p-1 text-[11px] print:text-[8px] font-black uppercase tracking-widest text-modern-muted cursor-pointer hover:text-modern-blue transition-colors w-40"
                      onClick={() => {
                        if (sortBy === 'fcExpiry') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('fcExpiry');
                          setSortOrder('asc');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        FC
                        {sortBy === 'fcExpiry' && (sortOrder === 'asc' ? <ArrowUpAz className="w-3 h-3" /> : <ArrowDownAz className="w-3 h-3" />)}
                      </div>
                    </th>
                  )}
                  
                  {(documentFilter === 'all' || documentFilter === 'permit') && (
                    <th className="px-4 py-3 print:p-1 text-[11px] print:text-[8px] font-black uppercase tracking-widest text-modern-muted w-40">Permit</th>
                  )}
                  
                  {(documentFilter === 'all' || documentFilter === 'insurance') && (
                    <th className="px-4 py-3 print:p-1 text-[11px] print:text-[8px] font-black uppercase tracking-widest text-modern-muted w-40">Insurance</th>
                  )}
                  
                  {(documentFilter === 'all' || documentFilter === 'nationalPermit') && (
                    <th className="px-4 py-3 print:p-1 text-[11px] print:text-[8px] font-black uppercase tracking-widest text-modern-muted w-40">Nat. Permit</th>
                  )}

                  <th className="px-4 py-3 print:p-1 text-[11px] print:text-[8px] font-black uppercase tracking-widest text-modern-muted w-40">Phone Number</th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase tracking-widest text-modern-muted w-48 no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-modern-border">
                {/* Inline Add Row */}
                {isAdmin && (
                  <tr className="bg-modern-blue/5 no-print">
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-black text-modern-blue uppercase tracking-widest">New</span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        placeholder="Vehicle No"
                        className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-sm font-bold focus:ring-2 focus:ring-modern-blue outline-none uppercase text-modern-text"
                        value={newVehicle.plateNumber}
                        onChange={(e) => setNewVehicle({ ...newVehicle, plateNumber: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        placeholder="Owner Name"
                        className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                        value={newVehicle.ownerName}
                        onChange={(e) => setNewVehicle({ ...newVehicle, ownerName: e.target.value })}
                      />
                    </td>
                    
                    {(documentFilter === 'all' || documentFilter === 'fc') && (
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                          value={newVehicle.fcExpiry}
                          onChange={(e) => setNewVehicle({ ...newVehicle, fcExpiry: e.target.value })}
                        />
                      </td>
                    )}
                    
                    {(documentFilter === 'all' || documentFilter === 'permit') && (
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                          value={newVehicle.permitExpiry}
                          onChange={(e) => setNewVehicle({ ...newVehicle, permitExpiry: e.target.value })}
                        />
                      </td>
                    )}
                    
                    {(documentFilter === 'all' || documentFilter === 'insurance') && (
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                          value={newVehicle.insuranceExpiry}
                          onChange={(e) => setNewVehicle({ ...newVehicle, insuranceExpiry: e.target.value })}
                        />
                      </td>
                    )}
                    
                    {(documentFilter === 'all' || documentFilter === 'nationalPermit') && (
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                          value={newVehicle.nationalPermitExpiry}
                          onChange={(e) => setNewVehicle({ ...newVehicle, nationalPermitExpiry: e.target.value })}
                        />
                      </td>
                    )}

                    <td className="px-4 py-3">
                      <input
                        placeholder="Phone"
                        className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                        value={newVehicle.phoneNumber}
                        onChange={(e) => setNewVehicle({ ...newVehicle, phoneNumber: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={handleAddVehicle}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-center gap-2 bg-modern-blue hover:bg-modern-blue/80 text-modern-text px-2 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-modern-blue/10"
                      >
                        {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Add
                      </button>
                    </td>
                  </tr>
                )}

                {filteredVehicles.map((vehicle, index) => (
                  <tr 
                    key={vehicle.id} 
                    onClick={() => !editingId && onViewDetails(vehicle)}
                    className={cn(
                      "group transition-colors print:h-[5mm]",
                      !editingId && "hover:bg-slate-50 cursor-pointer",
                      editingId === vehicle.id && "bg-modern-blue/5"
                    )}
                  >
                    <td className="px-4 py-3 print:p-1">
                      <span className="text-xs font-black text-slate-300 print:text-[8px]">{index + 1}</span>
                    </td>
                    <td className="px-4 py-3 print:p-1">
                      {editingId === vehicle.id ? (
                        <input
                          className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-sm font-bold focus:ring-2 focus:ring-modern-blue outline-none uppercase text-modern-text"
                          value={editData.plateNumber}
                          onChange={(e) => setEditData({ ...editData, plateNumber: e.target.value })}
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-1 rounded-lg shadow-sm border border-slate-100 shrink-0 print:hidden">
                            <Logo className="w-8 h-8 object-contain" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-base print:text-[9px] font-display print:font-bold font-bold text-modern-text truncate group-hover:text-modern-blue transition-colors uppercase">{vehicle.plateNumber}</p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 print:p-1">
                      {editingId === vehicle.id ? (
                        <input
                          className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                          value={editData.ownerName}
                          onChange={(e) => setEditData({ ...editData, ownerName: e.target.value })}
                        />
                      ) : (
                        <p className="text-xs print:text-[8px] font-bold text-modern-muted uppercase tracking-widest truncate">{vehicle.ownerName}</p>
                      )}
                    </td>

                    {(documentFilter === 'all' || documentFilter === 'fc') && (
                      <td className="px-4 py-3 print:p-1">
                        {editingId === vehicle.id ? (
                          <input
                            type="date"
                            className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                            value={editData.fcExpiry}
                            onChange={(e) => setEditData({ ...editData, fcExpiry: e.target.value })}
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-xs print:text-[8px] font-bold",
                              getExpiryStatus(vehicle.fcExpiry) === 'expired' ? "text-rose-500" : 
                              getExpiryStatus(vehicle.fcExpiry) === 'soon' ? "text-orange-500" : "text-modern-text"
                            )}>
                              {vehicle.fcExpiry ? format(new Date(vehicle.fcExpiry), 'dd MMM yyyy') : '-'}
                            </span>
                          </div>
                        )}
                      </td>
                    )}

                    {(documentFilter === 'all' || documentFilter === 'permit') && (
                      <td className="px-4 py-3 print:p-1">
                        {editingId === vehicle.id ? (
                          <input
                            type="date"
                            className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                            value={editData.permitExpiry}
                            onChange={(e) => setEditData({ ...editData, permitExpiry: e.target.value })}
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-xs print:text-[8px] font-bold",
                              getExpiryStatus(vehicle.permitExpiry) === 'expired' ? "text-rose-500" : 
                              getExpiryStatus(vehicle.permitExpiry) === 'soon' ? "text-orange-500" : "text-modern-text"
                            )}>
                              {vehicle.permitExpiry ? format(new Date(vehicle.permitExpiry), 'dd MMM yyyy') : '-'}
                            </span>
                          </div>
                        )}
                      </td>
                    )}

                    {(documentFilter === 'all' || documentFilter === 'insurance') && (
                      <td className="px-4 py-3 print:p-1">
                        {editingId === vehicle.id ? (
                          <input
                            type="date"
                            className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                            value={editData.insuranceExpiry}
                            onChange={(e) => setEditData({ ...editData, insuranceExpiry: e.target.value })}
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-xs print:text-[8px] font-bold",
                              getExpiryStatus(vehicle.insuranceExpiry) === 'expired' ? "text-rose-500" : 
                              getExpiryStatus(vehicle.insuranceExpiry) === 'soon' ? "text-orange-500" : "text-modern-text"
                            )}>
                              {vehicle.insuranceExpiry ? format(new Date(vehicle.insuranceExpiry), 'dd MMM yyyy') : '-'}
                            </span>
                          </div>
                        )}
                      </td>
                    )}

                    {(documentFilter === 'all' || documentFilter === 'nationalPermit') && (
                      <td className="px-4 py-3 print:p-1">
                        {editingId === vehicle.id ? (
                          <input
                            type="date"
                            className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                            value={editData.nationalPermitExpiry}
                            onChange={(e) => setEditData({ ...editData, nationalPermitExpiry: e.target.value })}
                          />
                        ) : (
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-xs print:text-[8px] font-bold",
                              getExpiryStatus(vehicle.nationalPermitExpiry) === 'expired' ? "text-rose-500" : 
                              getExpiryStatus(vehicle.nationalPermitExpiry) === 'soon' ? "text-orange-500" : "text-modern-text"
                            )}>
                              {vehicle.nationalPermitExpiry ? format(new Date(vehicle.nationalPermitExpiry), 'dd MMM yyyy') : '-'}
                            </span>
                          </div>
                        )}
                      </td>
                    )}

                    <td className="px-4 py-3 print:p-1">
                      {editingId === vehicle.id ? (
                        <input
                          className="w-full px-2 py-1 bg-white border border-modern-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-modern-blue outline-none text-modern-text"
                          value={editData.phoneNumber}
                          onChange={(e) => setEditData({ ...editData, phoneNumber: e.target.value })}
                        />
                      ) : (
                        <span className="text-xs print:text-[8px] font-black text-modern-muted tracking-wider">{vehicle.phoneNumber}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 no-print">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {editingId === vehicle.id ? (
                          <>
                            <button
                              onClick={() => handleUpdateVehicle(vehicle.id!)}
                              className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(vehicle)}
                              className="p-2 text-slate-400 hover:text-modern-blue hover:bg-modern-blue/5 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                const info = getEarliestExpiryInfo(vehicle);
                                handleSendReminder(vehicle, info.type, info.date || '');
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Send Reminder"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(vehicle)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingVehicle && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60] no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-modern-border"
            >
              <div className="bg-rose-500 p-6 flex justify-between items-center text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-display font-bold tracking-tight uppercase">Confirm Delete</h2>
                </div>
                <button onClick={() => setDeletingVehicle(null)} className="hover:bg-white/10 p-2 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 text-center">
                <div className="bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-10 h-10 text-rose-500" />
                </div>
                <h3 className="text-xl font-bold text-modern-text mb-2">Are you sure?</h3>
                <p className="text-modern-muted mb-8">
                  You are about to delete vehicle <span className="font-black text-modern-text">{deletingVehicle.plateNumber}</span>. This action cannot be undone.
                </p>
                
                <div className="flex gap-4">
                  <button 
                    onClick={() => setDeletingVehicle(null)}
                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-modern-muted font-black uppercase tracking-widest text-xs rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-4 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-lg shadow-rose-100"
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
    </div>
  );
}
