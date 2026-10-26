import {
    ArrowLeftRight,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Repeat,
    XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { useAttendanceLiveUpdates } from "../../hooks/Useattendanceliveupdates";
import { saturdaySwapService } from "../../services/saturdaySwapService";

// ---------------------------------------------------------------------
// Saturday Swap -- "I'll skip my 2nd Saturday and work a 1st/3rd instead."
//
// Same screen for every role (mounted from routes/commonRoutes.jsx):
//   1. Request form  - only offers Saturdays the backend says are valid
//                      (GET /saturday-swaps/options).
//   2. My requests   - status + Cancel.
//   3. Team requests - shown only to people who are someone's approver
//                      (GET /saturday-swaps/team); Approve / Reject appear
//                      where the backend says can_decide.
// Once a request is Approved the backend treats the worked Saturday as a
// normal working day (attendance = Present) and the skipped Saturday as a
// week-off, so there is nothing else to do here.
// ---------------------------------------------------------------------

const STATUS_STYLES = {
  Approved: { text: "text-blue-600", bg: "bg-blue-50", icon: CheckCircle2 },
  Pending: { text: "text-orange-600", bg: "bg-orange-50", icon: Clock },
  Rejected: { text: "text-red-500", bg: "bg-red-50", icon: XCircle },
  Cancelled: { text: "text-slate-500", bg: "bg-slate-100", icon: XCircle },
};

const ORDINALS = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th" };

function parseDay(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function prettyDay(iso) {
  if (!iso) return "—";
  const date = parseDay(iso);
  const nth = Math.floor((date.getDate() - 1) / 7) + 1;
  const text = date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${text} (${ORDINALS[nth] || `${nth}th`} Sat)`;
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
}

// One tappable card per Saturday (single select).
function DayPicker({ title, hint, tone, items, value, onChange }) {
  const active =
    tone === "green"
      ? "border-green-600 bg-green-50 ring-1 ring-green-600"
      : "border-orange-500 bg-orange-50 ring-1 ring-orange-500";
  const numColor = tone === "green" ? "text-green-700" : "text-orange-600";
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mb-2 text-xs text-slate-500">{hint}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">No Saturdays left this month.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((o) => {
            const d = parseDay(o.date);
            const selected = o.date === value;
            return (
              <button
                type="button"
                key={o.date}
                onClick={() => onChange(selected ? "" : o.date)}
                className={`w-[calc(50%-0.25rem)] rounded-xl border px-2 py-2 text-center transition md:w-24 md:px-3 ${
                  selected
                    ? active
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span
                  className={`block text-2xl font-bold leading-none ${numColor}`}
                >
                  {d.getDate()}
                </span>
                <span className="block text-xs text-slate-500">
                  {d.toLocaleDateString([], { month: "short" })} · Sat
                </span>
                <span className="mt-1 block text-[11px] font-medium text-slate-600">
                  {ORDINALS[o.nth] || `${o.nth}th`} Saturday
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Cancelled;
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${s.bg} ${s.text}`}
    >
      <Icon size={12} />
      {status}
    </span>
  );
}

function SwapCard({ swap, showEmployee, actions }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {showEmployee && (
            <p className="text-sm font-semibold text-slate-800">
              {swap.employees?.full_name || "Employee"}
            </p>
          )}
          <p className="text-sm text-slate-700">
            <span className="font-medium text-green-700">Works</span>{" "}
            {prettyDay(swap.work_date)}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium text-orange-600">Off</span>{" "}
            {prettyDay(swap.off_date)}
          </p>
          {swap.reason && (
            <p className="mt-1 text-xs text-slate-500">“{swap.reason}”</p>
          )}
          {swap.comments && (
            <p className="mt-1 text-xs text-slate-500">
              Manager: {swap.comments}
            </p>
          )}
        </div>
        <StatusChip status={swap.status} />
      </div>
      {actions}
    </div>
  );
}

export default function SaturdaySwap() {
  const [options, setOptions] = useState(null);
  const [mine, setMine] = useState(null);
  const [team, setTeam] = useState([]);

  const [offDate, setOffDate] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actingOn, setActingOn] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => {
    saturdaySwapService
      .getOptions()
      .then((data) => {
        setLoadError("");
        setOptions(data);
      })
      .catch((err) => {
        setOptions({ working_saturdays: [], off_saturdays: [] });
        setLoadError(
          err?.message ||
            "Couldn't load Saturday swap data. Is the backend updated and the SQL migration run?",
        );
      });
    saturdaySwapService
      .getMine()
      .then(setMine)
      .catch(() => setMine([]));
    saturdaySwapService
      .getTeam()
      .then(setTeam)
      .catch(() => setTeam([]));
  }, []);

  useEffect(load, [load]);
  useAttendanceLiveUpdates(load);

  const allOff = options?.working_saturdays || []; // Saturdays I can skip
  const allWork = options?.off_saturdays || []; // Saturdays I can work instead

  // Months shown in the stepper. The backend sends the current month, plus
  // next month once the current one is in its last days (options.months).
  // Falls back to the months found in the Saturdays for older backends.
  const months = useMemo(() => {
    if (options?.months?.length) return options.months;
    return [...new Set([...allOff, ...allWork].map((o) => o.month))].sort();
  }, [allOff, allWork, options]);

  // When both Saturdays must be in the same month, a month is only usable if
  // it has BOTH kinds.
  const monthHasSwap = useCallback(
    (m) => {
      const hasOff = allOff.some((o) => o.month === m);
      const hasWork = allWork.some((o) => o.month === m);
      return options?.same_month_required
        ? hasOff && hasWork
        : hasOff || hasWork;
    },
    [allOff, allWork, options],
  );

  const [month, setMonth] = useState("");
  const activeMonth = months.includes(month)
    ? month
    : months.find(monthHasSwap) || months[0] || "";
  const monthIndex = months.indexOf(activeMonth);

  const offChoices = allOff.filter((o) => o.month === activeMonth);
  const workChoices = options?.same_month_required
    ? allWork.filter((o) => o.month === activeMonth)
    : allWork;
  const offSelected = offChoices.find((o) => o.date === offDate);
  const workSelected = workChoices.find((o) => o.date === workDate);

  function chooseMonth(value) {
    setMonth(value);
    setOffDate("");
    setWorkDate("");
    setError("");
    setNotice("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!offDate || !workDate) {
      setError("Please choose both Saturdays.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Please add a short reason.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await saturdaySwapService.apply({
        offDate,
        workDate,
        reason: reason.trim(),
      });
      setNotice(res?.message || "Saturday swap requested.");
      setOffDate("");
      setWorkDate("");
      setReason("");
      load();
    } catch (err) {
      setError(err.message || "Unable to request the swap.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(swap) {
    if (!window.confirm("Cancel this Saturday swap request?")) return;
    setActingOn(swap.id);
    setError("");
    try {
      await saturdaySwapService.cancel(swap.id);
      load();
    } catch (err) {
      setError(err.message || "Unable to cancel this request.");
    } finally {
      setActingOn(null);
    }
  }

  async function decide(swap, status) {
    let comments;
    if (status === "Rejected") {
      comments = window.prompt("Reason for rejecting (optional):") ?? undefined;
    }
    setActingOn(swap.id);
    setError("");
    try {
      await saturdaySwapService.decide(swap.id, status, comments);
      load();
    } catch (err) {
      setError(err.message || "Unable to update this request.");
    } finally {
      setActingOn(null);
    }
  }

  const today = new Date(new Date().setHours(0, 0, 0, 0));
  function canCancel(swap) {
    if (swap.status === "Pending") return true;
    if (swap.status !== "Approved") return false;
    const first = [parseDay(swap.work_date), parseDay(swap.off_date)].sort(
      (a, b) => a - b,
    )[0];
    return first > today;
  }

  const noOptions =
    options && allOff.length === 0 && allWork.length === 0 && !options.months;
  const nextOpensOn = options?.next_month_opens_on
    ? parseDay(options.next_month_opens_on).toLocaleDateString([], {
        day: "numeric",
        month: "short",
      })
    : "";

  return (
    <div>
      <PageHeader
        title="Saturday Swap"
        subtitle="Skip one of your regular working Saturdays and work a normally-off Saturday instead."
        hideSubtitleOnMobile
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
          {notice}
        </div>
      )}

      {/* ---------------- request form ---------------- */}
      <form
        onSubmit={submit}
        className="mb-8 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div className="mb-4 flex items-center gap-2 text-slate-800">
          <Repeat size={18} />
          <h2 className="text-base font-semibold">Request a swap</h2>
        </div>

        {options === null ? (
          <p className="text-sm text-slate-500">Loading your Saturdays…</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : noOptions ? (
          <p className="text-sm text-slate-500">
            {options.hint ||
              "There are no swappable Saturdays coming up for you. A swap needs one of your regular working Saturdays and one regular off Saturday."}
          </p>
        ) : (
          <div className="space-y-5">
            {/* month stepper: current month, next month near month end */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <button
                type="button"
                aria-label="Previous month"
                disabled={monthIndex <= 0}
                onClick={() => chooseMonth(months[monthIndex - 1])}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[10rem] text-center text-base font-semibold text-slate-800">
                {activeMonth ? monthLabel(activeMonth) : "—"}
              </span>
              <button
                type="button"
                aria-label="Next month"
                disabled={monthIndex >= months.length - 1}
                onClick={() => chooseMonth(months[monthIndex + 1])}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
              >
                <ChevronRight size={16} />
              </button>
              {nextOpensOn && (
                <span className="w-full text-center text-xs text-slate-500 md:ml-1 md:w-auto md:text-left">
                  Next month opens on {nextOpensOn}
                </span>
              )}
            </div>

            {options.hint && allOff.length === 0 && allWork.length === 0 && (
              <p className="text-sm text-slate-500">{options.hint}</p>
            )}

            <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="rounded-xl bg-slate-50 p-3 md:p-4">
                <DayPicker
                  title="Saturday I want OFF"
                  hint="Your regular working Saturdays"
                  tone="orange"
                  items={offChoices}
                  value={offDate}
                  onChange={setOffDate}
                />
              </div>
              <ArrowLeftRight
                size={20}
                className="mx-auto rotate-90 text-slate-400 md:rotate-0"
                aria-hidden="true"
              />
              <div className="rounded-xl bg-slate-50 p-3 md:p-4">
                <DayPicker
                  title="Saturday I will WORK instead"
                  hint="Your regular off Saturdays"
                  tone="green"
                  items={workChoices}
                  value={workDate}
                  onChange={setWorkDate}
                />
              </div>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Reason
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Why do you need this swap?"
              />
            </label>

            {offSelected && workSelected && (
              <p className="hidden rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 md:block">
                You will be off on <b>{prettyDay(offSelected.date)}</b> and work
                on <b>{prettyDay(workSelected.date)}</b>. Once your manager
                approves, that Saturday is recorded as a normal working day in
                your attendance, and the skipped Saturday won’t count as absent.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </div>
        )}
      </form>

      {/* ---------------- team requests (approvers only) ---------------- */}
      {team.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-800">
            Requests from your team
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {team.map((swap) => (
              <SwapCard
                key={swap.id}
                swap={swap}
                showEmployee
                actions={
                  swap.can_decide && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => decide(swap, "Approved")}
                        disabled={actingOn === swap.id}
                        className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => decide(swap, "Rejected")}
                        disabled={actingOn === swap.id}
                        className="rounded-lg border border-orange-200 px-3.5 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- my requests ---------------- */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          My requests
        </h2>
        {mine === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : mine.length === 0 ? (
          <p className="text-sm text-slate-500">No Saturday swaps yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {mine.map((swap) => (
              <SwapCard
                key={swap.id}
                swap={swap}
                actions={
                  canCancel(swap) && (
                    <button
                      onClick={() => cancel(swap)}
                      disabled={actingOn === swap.id}
                      className="mt-3 rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel request
                    </button>
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
