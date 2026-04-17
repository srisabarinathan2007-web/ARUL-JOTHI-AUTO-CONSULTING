export interface Vehicle {
  id?: string;
  plateNumber: string;
  ownerName: string;
  phoneNumber: string;
  fcExpiry?: string;
  permitExpiry?: string;
  insuranceExpiry?: string;
  nationalPermitExpiry?: string;
  lastReminderSent?: string;
  lastSync?: string;
}

export interface TaxRecord {
  id?: string;
  plateNumber: string;
  ownerName: string;
  phoneNumber: string;
  taxType: string;
  taxPeriodType?: 'Quarterly' | 'Annual';
  taxAmount: string;
  gt: string;
  information: string;
  inDate: string;
  paidDate: string;
  taxExpiry?: string;
  lastReminderSent?: string;
}

export interface BillingRecord {
  id?: string;
  date: string;
  customerName: string;
  phoneNumber: string;
  vehicleNumber: string;
  serviceDescription: string;
  amount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: 'Paid' | 'Pending' | 'Partial';
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';
  notes?: string;
  createdAt: string;
}

export type ExpiryType = 'fc' | 'permit' | 'insurance' | 'nationalPermit' | 'tax';
