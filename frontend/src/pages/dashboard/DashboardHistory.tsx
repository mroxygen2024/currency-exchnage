import { useState } from 'react';
import { Download, Search, Trash2, Eye, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { useHistoryList, useDeleteHistoryRecord } from '../../hooks/useHistory';
import { historyApi, HistoryExportParams, HistoryFilterParams } from '../../api/endpoints/history';
import { CurrencyConversionOut } from '../../api/types';
import { HistoryDetailModal } from '../../components/history/HistoryDetailModal';
import { Dialog, DialogActions, DialogButton } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';

type SortField = 'converted_at' | 'amount' | 'rate' | 'result';
type SortOrder = 'asc' | 'desc';

export function DashboardHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('converted_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedRecord, setSelectedRecord] = useState<CurrencyConversionOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const itemsPerPage = 6;
  const toast = useToast();

  const filters: HistoryFilterParams = {
    page: currentPage,
    limit: itemsPerPage,
    sort_by: sortField,
    sort_order: sortOrder,
  };

  if (dateFilter !== 'all') {
    const now = new Date();
    if (dateFilter === 'today') {
      filters.start_date = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (dateFilter === 'week') {
      filters.start_date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (dateFilter === 'month') {
      filters.start_date = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  if (searchTerm.trim().length === 3) {
    filters.from_currency = searchTerm.trim().toUpperCase();
  }

  const { data: historyData, isLoading, error } = useHistoryList(filters);
  const deleteMutation = useDeleteHistoryRecord();

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget !== null) {
      deleteMutation.mutate(deleteTarget, {
        onSuccess: () => {
          setDeleteTarget(null);
          toast.success('Record deleted', `Conversion record #${deleteTarget} has been deleted.`);
        },
        onError: () => {
          toast.error('Delete failed', 'Unable to delete record. Please try again.');
          setDeleteTarget(null);
        },
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      const exportParams: HistoryExportParams = {};
      if (dateFilter !== 'all') {
        const now = new Date();
        if (dateFilter === 'today') {
          exportParams.start_date = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        } else if (dateFilter === 'week') {
          exportParams.start_date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (dateFilter === 'month') {
          exportParams.start_date = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        }
      }
      if (searchTerm.trim().length === 3) {
        exportParams.from_currency = searchTerm.trim().toUpperCase();
      }

      const blob = await historyApi.exportHistory(exportParams);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AeroExchange_History_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Export complete', 'CSV file has been downloaded.');
    } catch (err) {
      toast.error('Export failed', 'Unable to export history. Please try again.');
    }
  };

  const totalPages = historyData?.pages || 1;
  const currentItems = historyData?.items || [];
  const totalItems = historyData?.total || 0;
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage;
  const indexOfLastItem = indexOfFirstItem + currentItems.length;

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc'
      ? <ChevronUp size={14} className="inline ml-0.5" />
      : <ChevronDown size={14} className="inline ml-0.5" />;
  };

  return (
    <div className="space-y-6">
      <div className="dashboard-page-title flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1>Conversion History</h1>
          <p>Review and manage your conversion history. Export or search through past transactions.</p>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={totalItems === 0 || isLoading}
          className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="glass-widget p-4 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by currency code (e.g. USD)..."
            className="w-full h-10 pl-10 pr-4 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 font-medium text-sm"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="date-select" className="text-xs font-bold text-slate-500">
              Date Range:
            </label>
            <select
              id="date-select"
              className="h-10 px-3 border border-slate-200 rounded-xl bg-white/70 font-semibold text-xs focus:outline-none focus:border-teal-600"
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-widget">
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleSort('converted_at')}
                    className="inline-flex items-center gap-1 hover:text-teal-600 transition-colors cursor-pointer"
                  >
                    Date &amp; Time {renderSortIcon('converted_at')}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleSort('amount')}
                    className="inline-flex items-center gap-1 hover:text-teal-600 transition-colors cursor-pointer"
                  >
                    From (Amount) {renderSortIcon('amount')}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleSort('result')}
                    className="inline-flex items-center gap-1 hover:text-teal-600 transition-colors cursor-pointer"
                  >
                    To (Received) {renderSortIcon('result')}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleSort('rate')}
                    className="inline-flex items-center gap-1 hover:text-teal-600 transition-colors cursor-pointer"
                  >
                    Exchange Rate {renderSortIcon('rate')}
                  </button>
                </th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: itemsPerPage }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={7} className="py-4">
                      <div className="h-4 bg-slate-100 animate-pulse rounded w-3/4 mx-auto" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-rose-500 font-semibold">
                    Unable to load conversion history. Please try again later.
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<Search size={28} />}
                      title="No conversions found"
                      description="Try adjusting your search or date filters."
                    />
                  </td>
                </tr>
              ) : (
                currentItems.map((log) => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs font-bold text-slate-500">
                      #{log.id}
                    </td>
                    <td className="text-sm font-medium text-slate-600">
                      {new Date(log.converted_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      <span className="text-xs text-slate-400 font-normal ml-1">
                        {new Date(log.converted_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="font-bold text-slate-700">
                      {log.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {log.from_currency}
                    </td>
                    <td className="font-extrabold text-teal-800">
                      {log.result.toLocaleString(undefined, { minimumFractionDigits: 2 })} {log.to_currency}
                    </td>
                    <td className="text-sm font-semibold text-slate-500">
                      {log.rate.toFixed(5)}
                    </td>
                    <td>
                      <span className="status-badge status-badge--completed">
                        completed
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(log)}
                          className="p-2 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer"
                          aria-label={`View details for log ${log.id}`}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(log.id)}
                          disabled={deleteMutation.isPending}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
                          aria-label={`Delete log ${log.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && !error && totalItems > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4 flex-col sm:flex-row gap-4">
            <span className="text-xs text-slate-500 font-medium">
              Showing {indexOfFirstItem + 1} to{' '}
              {Math.min(indexOfLastItem, totalItems)} of{' '}
              {totalItems} entries
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-9 px-3 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-9 w-9 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      currentPage === pageNum
                        ? 'bg-teal-600 border-teal-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-9 px-3 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedRecord && (
        <HistoryDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Record"
        description={`Are you sure you want to delete conversion record #${deleteTarget}? This action cannot be undone.`}
        size="sm"
        variant="destructive"
        icon={<AlertTriangle size={20} />}
        footer={
          <DialogActions>
            <DialogButton variant="default" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              Cancel
            </DialogButton>
            <DialogButton variant="destructive" onClick={handleDeleteConfirm} isLoading={deleteMutation.isPending}>
              Delete
            </DialogButton>
          </DialogActions>
        }
      >
        <p className="text-sm text-slate-500">
          This will permanently remove the record from your history. You won't be able to recover it.
        </p>
      </Dialog>
    </div>
  );
}
