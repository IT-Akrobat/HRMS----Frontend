import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { documentsService } from "../../services/documentsService";
import { parseServerDate } from "../../utils/date";

// ---------------------------------------------------------------------
// Company-wide Documents list for HR.
//
// Backend: GET /documents/ (app/documents/routes.py -> get_documents),
// gated on VIEW_DOCUMENTS — HR ADMIN / HR EXECUTIVE already hold this
// permission (sql/006_document_permissions_seed.sql), so this is the
// same "every employee's documents" visibility Super Admin has, just
// surfaced here as a dedicated list instead of per-employee inside a
// drawer (compare pages/super-admin/Users.jsx's UserViewModal, which
// calls documentsService.getForEmployee for one user at a time).
//
// Download re-uses documentsService.downloadFile -> GET
// /documents/{id}/file, which HR already qualifies for via the same
// VIEW_DOCUMENTS permission.
// ---------------------------------------------------------------------

const PAGE_SIZE = 20;

function formatDate(value) {
  const d = parseServerDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Documents() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    documentsService
      .getAll({ page, limit: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        setRecords(data.records || []);
        setTotal(data.total || 0);
      })
      .catch((err) => {
        if (cancelled) return;
        setRecords([]);
        setError(err.message || "Could not load documents.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((doc) => {
      const employeeName = doc.employees?.full_name || "";
      const employeeCode = doc.employees?.employee_id || "";
      return (
        doc.document_name?.toLowerCase().includes(q) ||
        doc.document_type?.toLowerCase().includes(q) ||
        employeeName.toLowerCase().includes(q) ||
        employeeCode.toLowerCase().includes(q)
      );
    });
  }, [records, search]);

  async function handleDownload(doc) {
    setDownloadError("");
    setDownloadingId(doc.id);
    try {
      await documentsService.downloadFile(doc.id, doc.document_name);
    } catch (err) {
      setDownloadError(err.message || "Could not download that document.");
    } finally {
      setDownloadingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Every document uploaded by every employee, company-wide."
      />

      <div className="mb-4 relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by employee, document name, or type…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {downloadError && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <AlertTriangle size={14} />
          {downloadError}
        </div>
      )}

      {/* Loading / error / empty states are shared by both the desktop table and the mobile card list below */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-400 text-sm py-16">
          <Loader2 size={16} className="animate-spin" />
          Loading documents…
        </div>
      ) : error ? (
        <div className="bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-red-600 text-sm py-16">
          <AlertTriangle size={16} />
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 text-sm py-16">
          <FileText size={24} />
          No documents found.
        </div>
      ) : (
        <>
          {/* Desktop / tablet — original table, unchanged, just hidden below md */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">
                        {doc.employees?.full_name || "—"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {doc.employees?.employee_id || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {doc.document_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {doc.document_type}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {doc.expiry_date ? formatDate(doc.expiry_date) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 text-xs font-medium disabled:opacity-50"
                      >
                        {downloadingId === doc.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Download size={14} />
                        )}
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile — card list, shown only below md, table above stays hidden here */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((doc) => {
              const isExpiring =
                doc.expiry_date &&
                (() => {
                  const d = parseServerDate(doc.expiry_date);
                  if (!d) return false;
                  const days = (d.getTime() - Date.now()) / 86400000;
                  return days >= 0 && days <= 30;
                })();

              return (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 flex gap-3 items-start"
                >
                  <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                    <FileText size={17} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-700 truncate">
                      {doc.document_name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      <span className="text-slate-500 font-medium">
                        {doc.employees?.full_name || "—"}
                      </span>
                      {doc.employees?.employee_id && (
                        <span>· {doc.employees.employee_id}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{doc.document_type}</span>
                      <span>· Uploaded {formatDate(doc.created_at)}</span>
                    </div>
                    {doc.expiry_date && (
                      <span
                        className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded ${
                          isExpiring
                            ? "bg-red-50 text-red-600"
                            : "bg-green-50 text-green-600"
                        }`}
                      >
                        Expires {formatDate(doc.expiry_date)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                    className="w-9 h-9 rounded-lg border border-slate-200 text-orange-600 flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                    aria-label="Download document"
                  >
                    {downloadingId === doc.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && !error && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-sm text-slate-500">
          <span>
            Page {page} of {totalPages} · {total} document
            {total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
