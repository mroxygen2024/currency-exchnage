import { X, ArrowRightLeft } from 'lucide-react';
import { CurrencyConversionOut } from '../../api/types';

interface HistoryDetailModalProps {
  record: CurrencyConversionOut;
  onClose: () => void;
}

export function HistoryDetailModal({ record, onClose }: HistoryDetailModalProps) {
  const formattedDate = new Date(record.converted_at).toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = new Date(record.converted_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Conversion record details"
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <ArrowRightLeft size={18} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Conversion Details</h2>
              <p className="text-xs text-slate-400 font-medium">Record #{record.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">From</p>
              <p className="text-2xl font-extrabold text-slate-800">
                {record.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm font-bold text-teal-600 mt-0.5">{record.from_currency}</p>
            </div>

            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <ArrowRightLeft size={16} className="text-slate-400" />
            </div>

            <div className="text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">To</p>
              <p className="text-2xl font-extrabold text-teal-700">
                {record.result.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm font-bold text-teal-600 mt-0.5">{record.to_currency}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Exchange Rate</p>
              <p className="text-sm font-bold text-slate-700 mt-1">1 {record.from_currency} = {record.rate.toFixed(5)} {record.to_currency}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
              <span className="status-badge status-badge--completed mt-1 inline-flex">completed</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
              <p className="text-sm font-semibold text-slate-700 mt-1">{formattedDate}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Time</p>
              <p className="text-sm font-semibold text-slate-700 mt-1">{formattedTime}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
