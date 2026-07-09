import { useEffect, useState } from 'react';
import { Download, Search, Trash2 } from 'lucide-react';
import {
  useConversionHistory,
  useDeleteHistoryRecord,
} from '../../hooks/useCurrency';
import { historyApi, HistoryExportParams, HistoryFilterParams } from '../../api/endpoints/history';

export function DashboardHistory() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Build query filters based on states
  const filters: HistoryFilterParams = {
    page: currentPage,
    limit: itemsPerPage,
    sort_by: 'converted_at',
    sort_order: 'desc',
  };

  if (dateFilter !== 'all') {
    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filters.start_date = today.toISOString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filters.start_date = weekAgo.toISOString();
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filters.start_date = monthAgo.toISOString();
    }
  }

  // Filter by currency code on the backend if a 3-letter search term is provided
  if (searchTerm.trim().length === 3) {
    filters.from_currency = searchTerm.trim().toUpperCase();
  }

  // Fetch conversion history using the query hook
  const {
    data: historyData,
    isLoading,
    error,
  } = useConversionHistory(filters);

  // Mutation for deleting a conversion log
  const deleteMutation = useDeleteHistoryRecord();

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter]);

  const handleDeleteLog = (id: number) => {
    deleteMutation.mutate(id);
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
      link.setAttribute('download', `AeroExchange_Conversions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV', err);
    }
  };

  const totalPages = historyData?.pages || 1;
  const currentItems = historyData?.items || [];
  const totalItems = historyData?.total || 0;

  // Calculate items ranges for description text
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage;
  const indexOfLastItem = indexOfFirstItem + currentItems.length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="dashboard-page-title flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1>Conversion History</h1>
          <p>Audit and search through your complete secure transaction history.</p>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={totalItems === 0 || isLoading}
          className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Download size={16} /> Export CSV File
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-widget p-4 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search by 3-letter currency code (e.g. USD)..."
            className="w-100 h-10 pl-10 pr-4 border border-slate-200 rounded-xl bg-white/70 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filters Select */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="status-select" className="text-xs font-bold text-slate-500">
              Status:
            </label>
            <select
              id="status-select"
              className="h-10 px-3 border border-slate-200 rounded-xl bg-white/70 font-semibold text-xs focus:outline-none focus:border-teal-600"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Logs (Completed)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="date-select" className="text-xs font-bold text-slate-500">
              Date Range:
            </label>
            <select
              id="date-select"
              className="h-10 px-3 border border-slate-200 rounded-xl bg-white/70 font-semibold text-xs focus:outline-none focus:border-teal-600"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-widget">
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Date &amp; Time</th>
                <th>From (Amount)</th>
                <th>To (Received)</th>
                <th>Exchange Rate</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: itemsPerPage }).map((_, idx) => (
                  <tr key={idx}>
                    <td colSpan={7} className="py-4 text-center">
                      <div className="h-4 bg-slate-100 animate-pulse rounded w-3/4 mx-auto" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-rose-500 font-semibold">
                    Failed to load conversion history. {error.message}
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                    No conversion logs matching the current filters.
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
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log.id)}
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

        {/* Pagination controls */}
        {!isLoading && !error && totalItems > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
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
    </div>
  );
}
