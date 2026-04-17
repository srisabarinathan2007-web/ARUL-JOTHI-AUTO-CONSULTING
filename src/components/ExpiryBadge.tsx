import { differenceInDays, format, isBefore, addDays } from 'date-fns';
import { cn } from '../lib/utils';

interface ExpiryBadgeProps {
  date: string;
  label: string;
  reminderDays?: number;
}

export default function ExpiryBadge({ date, label, reminderDays = 15 }: ExpiryBadgeProps) {
  if (!date) return (
    <div className="flex flex-col p-3 rounded-2xl border border-modern-border bg-slate-50/50 opacity-40 grayscale">
      <span className="text-[11px] uppercase font-black tracking-[0.15em] text-modern-muted mb-1">{label}</span>
      <span className="text-sm font-bold text-modern-muted">Not Set</span>
    </div>
  );

  const expiryDate = new Date(date);
  const today = new Date();
  const daysRemaining = differenceInDays(expiryDate, today);
  const isExpired = isBefore(expiryDate, today);
  const isExpiringSoon = daysRemaining <= reminderDays && !isExpired;

  return (
    <div className={cn(
      "flex flex-col p-3 rounded-xl border transition-all duration-300 hover:scale-[1.02]",
      isExpired ? "bg-rose-50 border-rose-100 text-rose-600 shadow-sm" :
      isExpiringSoon ? "bg-orange-50 border-orange-100 text-orange-600 shadow-sm" :
      "bg-slate-50 border-modern-border text-modern-text shadow-sm"
    )}>
      <span className="text-[11px] uppercase font-black tracking-[0.15em] opacity-60 mb-1">{label}</span>
      <span className="text-base font-bold font-display">{format(expiryDate, 'dd MMM yyyy')}</span>
      <div className="flex items-center gap-1.5 mt-1">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full",
          isExpired ? "bg-rose-500" : 
          isExpiringSoon ? "bg-orange-500" : 
          "bg-modern-blue"
        )} />
        <span className="text-xs font-black uppercase tracking-wider">
          {isExpired ? 'Expired' : `${daysRemaining} days`}
        </span>
      </div>
    </div>
  );
}
