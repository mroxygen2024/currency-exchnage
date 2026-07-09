import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmationDialogProps {
  recordId: number;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function DeleteConfirmationDialog({
  recordId,
  onConfirm,
  onCancel,
  isPending = false,
}: DeleteConfirmationDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete"
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Delete Record</h2>
          <p className="text-sm text-slate-500 mt-2">
            Are you sure you want to delete conversion record <span className="font-bold text-slate-700">#{recordId}</span>?
            This action cannot be undone.
          </p>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 h-10 text-xs font-bold border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 h-10 text-xs font-bold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
