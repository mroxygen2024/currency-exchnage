import { useEffect, useState } from 'react';
import { Download, Search, Trash2 } from 'lucide-react';

interface ConversionLog {
  id: string;
  date: string;
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: number;
  rate: number;
  status: 'completed' | 'pending' | 'failed';
}

export function DashboardHistory() {
  const [conversions, setConversions] = useState<ConversionLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    const saved = localStorage.getItem('aero:mock-conversions');
    if (saved) {
      setConversions(JSON.parse(saved) as ConversionLog[]);
    }
  }, []);

  // Sync state back to localStorage when deleted
  const handleDeleteLog = (id: string) => {
    const updated = conversions.filter((c) => c.id !== id);
    setConversions(updated);
    localStorage.setItem('aero:mock-conversions', JSON.stringify(updated));
  };

  // CSV Exporter Simulation
  const handleExportCSV = () => {
    if (conversions.length === 0) return;

    // Header row
    const headers = ['ID', 'Date', 'Source Currency', 'Source Amount', 'Target Currency', 'Target Amount', 'Rate', 'Status'];
    const rows = conversions.map((c) => [
      c.id,
      new Date(c.date).toLocaleString(),
      c.fromCurrency,
      c.fromAmount,
      c.toCurrency,
      c.toAmount,
      c.rate,
      c.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AeroExchange_Conversions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filters logic
  const filteredConversions = conversions.filter((c) => {
    // Search filter
    const matchesSearch =
      c.fromCurrency.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.toCurrency.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;

    // Date filter
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const logDate = new Date(c.date).getTime();
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      if (dateFilter === 'today') {
        matchesDate = now - logDate <= oneDay;
      } else if (dateFilter === 'week') {
        matchesDate = now - logDate <= oneDay * 7;
      } else if (dateFilter === 'month') {
        matchesDate = now - logDate <= oneDay * 30;
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter]);

  // Page slice
  const totalPages = Math.max(1, Math.ceil(filteredConversions.length / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredConversions.slice(indexOfFirstItem, indexOfLastItem);

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
          disabled={conversions.length === 0}
          className="inline-flex items-center justify-center gap-2 h-11 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-xl transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
            placeholder="Search by currency code or ID..."
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
              <option value="all">All Logs</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
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
              {currentItems.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono text-xs font-bold text-slate-500">
                    #{log.id.toUpperCase()}
                  </td>
                  <td className="text-sm font-medium text-slate-600">
                    {new Date(log.date).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    <span className="text-xs text-slate-400 font-normal ml-1">
                      {new Date(log.date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="font-bold text-slate-700">
                    {log.fromAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {log.fromCurrency}
                  </td>
                  <td className="font-extrabold text-teal-800">
                    {log.toAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} {log.toCurrency}
                  </td>
                  <td className="text-sm font-semibold text-slate-500">
                    {log.rate.toFixed(5)}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${
                        log.status === 'completed'
                          ? 'status-badge--completed'
                          : log.status === 'pending'
                          ? 'status-badge--pending'
                          : 'status-badge--failed'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        aria-label={`Delete log ${log.id}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredConversions.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                    No conversion logs matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {filteredConversions.length > itemsPerPage && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
            <span className="text-xs text-slate-500 font-medium">
              Showing {indexOfFirstItem + 1} to{' '}
              {Math.min(indexOfLastItem, filteredConversions.length)} of{' '}
              {filteredConversions.length} entries
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-9 px-3 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                    className={`h-9 w-9 text-xs font-bold rounded-lg border transition-all ${
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
                className="h-9 px-3 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
