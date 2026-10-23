import { CheckCircle2, FileText, Loader2, Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import {
  leaveMcService,
  MC_ACCEPTED_TYPES,
} from "../../services/leaveMcService";

const fmt = (d) =>
  d
    ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        },
      )
    : "";

// MC step 2 + HR validation, shared by every leave screen.
//   mode="employee" -> employee enters the END DATE printed on the certificate and
//                      attaches / replaces it (days are calculated from that date)
//   mode="hr"       -> HR / Super Admin sees the certificate end date + calculated
//                      days (nobody else does yet) and validates the MC
//   mode="view"     -> leave manager: view only, no days until HR validates
// `leave` is a leave_requests row (mc_status, mc_certificate_name, ...).
// Renders nothing for leaves that are not MC.
const STATUS_LABEL = {
  AWAITING_CERTIFICATE: {
    text: "Certificate not uploaded",
    cls: "bg-orange-50 text-orange-600",
  },
  CERTIFICATE_UPLOADED: {
    text: "Certificate uploaded · awaiting HR",
    cls: "bg-blue-50 text-blue-600",
  },
  VALIDATED: { text: "Validated by HR", cls: "bg-green-50 text-green-700" },
};

export default function McCertificate({ leave, mode = "view", onChanged }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Last day of medical leave on the certificate. Defaults to the applied end
  // date; the employee changes it when the doctor gave more days.
  const [endDate, setEndDate] = useState("");

  if (!leave?.mc_status) return null;
  const startIso = String(leave.start_date).slice(0, 10);
  const certEnd =
    endDate || String(leave.mc_end_date || leave.end_date).slice(0, 10);
  const status = STATUS_LABEL[leave.mc_status];
  const hasFile = leave.mc_status !== "AWAITING_CERTIFICATE";

  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      onChanged?.();
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleView() {
    await run(async () => {
      const url = await leaveMcService.getCertificateUrl(leave.id);
      if (url) window.open(url, "_blank", "noopener");
    });
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (certEnd < startIso) {
      setError("Certificate end date cannot be before the leave start date.");
      return;
    }
    run(() => leaveMcService.uploadCertificate(leave.id, file, certEnd));
  }

  const btn =
    "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50";

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${status.cls}`}
      >
        {leave.mc_status === "VALIDATED" && <CheckCircle2 size={11} />}
        {status.text}
      </span>

      {hasFile && (
        <button
          type="button"
          onClick={handleView}
          disabled={busy}
          className={btn}
        >
          <FileText size={12} /> View certificate
        </button>
      )}

      {mode === "employee" && leave.mc_status !== "VALIDATED" && (
        <>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            Certificate end date
            <input
              type="date"
              value={certEnd}
              min={startIso}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={busy}
              className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600"
            />
          </label>
          <input
            ref={inputRef}
            type="file"
            accept={MC_ACCEPTED_TYPES}
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={btn}
          >
            <Paperclip size={12} />
            {hasFile ? "Replace certificate" : "Attach certificate"}
          </button>
        </>
      )}

      {mode === "hr" && leave.mc_status === "CERTIFICATE_UPLOADED" && (
        <span className="text-[11px] text-slate-500">
          Certificate end date {fmt(leave.mc_end_date)}
          {leave.total_days != null && ` · ${leave.total_days} working day(s)`}
          {leave.mc_end_date &&
            String(leave.mc_end_date).slice(0, 10) >
              String(leave.end_date).slice(0, 10) &&
            ` (applied till ${fmt(leave.end_date)})`}
        </span>
      )}

      {mode === "hr" && leave.mc_status === "CERTIFICATE_UPLOADED" && (
        <button
          type="button"
          onClick={() => run(() => leaveMcService.validate(leave.id))}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <CheckCircle2 size={12} /> Validate as MC
        </button>
      )}

      {busy && <Loader2 size={13} className="animate-spin text-slate-400" />}
      {error && <span className="text-[11px] text-orange-600">{error}</span>}
    </div>
  );
}
