import {
    AlertTriangle,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    ExternalLink,
    Layers,
    LogIn,
    LogOut,
    MapPin,
    Navigation,
    X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";
import { parseServerDate, toLocalISODate } from "../../utils/date";

// ============================================================================
// My Profile -> Sites Worked
// ============================================================================
// Every site this employee has ever logged a visit to, as a card. Clicking a
// card opens a right-side drawer with the full history for that site: every
// visit (arrival/departure time, how long, and a map link for each end of
// the visit so "travel" — where they actually checked in/out from — is
// visible too), not just the lifetime total.
//
// Data sources (both already used elsewhere in the app, nothing new on the
// backend needed):
//   GET /auth/me                           -> internal employee id + joining_date
//   GET /attendance/employee/{id}/site-visits?from_date=&to_date=
//       -> day-by-day visits, each with locations{id, location_name,
//          location_code, address} and arrival/departure time + lat/long
//          (app/attendance/routes.py — self access is allowed: the service
//          lets an employee view their own history, see
//          get_employee_site_visits_history in app/attendance/services.py)
//   GET /site-assignments/my               -> sites currently assigned to
//          this employee (address, radius, assigned since), so a site
//          shows up as a card even before the first visit is logged.
// ============================================================================

const FALLBACK_START_DATE = "2000-01-01";

function formatDate(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d?.getTime?.())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value) {
  const d = parseServerDate(value);
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return "In progress";
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

function mapLink(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined)
    return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function ProfileSites() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [visits, setVisits] = useState([]); // flattened, one row per site visit
  const [assignments, setAssignments] = useState([]); // GET /site-assignments/my

  const [activeSiteKey, setActiveSiteKey] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const meRes = await apiClient.get("/auth/me");
        const me = meRes?.data || meRes;
        const internalId = me?.profile?.id;
        if (!internalId) {
          throw new Error("Could not find your employee record.");
        }

        const fromDate = me?.profile?.joining_date || FALLBACK_START_DATE;
        const toDate = toLocalISODate();

        const [visitsRes, assignRes] = await Promise.all([
          apiClient.get(
            `/attendance/employee/${internalId}/site-visits?from_date=${fromDate}&to_date=${toDate}`,
          ),
          apiClient.get("/site-assignments/my").catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        const days = visitsRes?.data || visitsRes || [];
        const flattened = days.flatMap((day) =>
          (day.visits || []).map((v) => ({
            ...v,
            attendance_date: day.attendance_date,
          })),
        );
        setVisits(flattened);
        setAssignments(assignRes?.data || assignRes || []);
      } catch (err) {
        if (!cancelled)
          setError(err.message || "Could not load your sites worked.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------- Group visits + assignments into one "site" per card ----------------
  const sites = useMemo(() => {
    const byKey = new Map();

    function keyFor(locationId, locationName) {
      return locationId || `name:${locationName || "Unknown Site"}`;
    }

    for (const v of visits) {
      const loc = v.locations || {};
      const key = keyFor(v.location_id, loc.location_name);
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          location_id: v.location_id || null,
          location_name: loc.location_name || "Unknown Site",
          location_code: loc.location_code || "",
          address: loc.address || "",
          isAssigned: false,
          assignedSince: null,
          radius: null,
          visits: [],
        });
      }
      byKey.get(key).visits.push(v);
    }

    for (const a of assignments) {
      const loc = a.locations || {};
      const key = keyFor(loc.id, loc.location_name);
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          location_id: loc.id || null,
          location_name: loc.location_name || "Unknown Site",
          location_code: loc.location_code || "",
          address: loc.address || "",
          isAssigned: true,
          assignedSince: a.created_at || null,
          radius: loc.radius ?? null,
          visits: [],
        });
      } else {
        const entry = byKey.get(key);
        entry.isAssigned = true;
        entry.assignedSince = a.created_at || entry.assignedSince;
        entry.radius = loc.radius ?? entry.radius;
        entry.address = entry.address || loc.address || "";
      }
    }

    const list = Array.from(byKey.values()).map((site) => {
      const sortedVisits = [...site.visits].sort(
        (a, b) =>
          (parseServerDate(b.arrival_time)?.getTime() || 0) -
          (parseServerDate(a.arrival_time)?.getTime() || 0),
      );
      const totalMinutes = sortedVisits.reduce(
        (sum, v) => sum + (v.duration_minutes || 0),
        0,
      );
      const openVisit = sortedVisits.find((v) => !v.departure_time);
      return {
        ...site,
        visits: sortedVisits,
        visitCount: sortedVisits.length,
        totalMinutes,
        firstVisit: sortedVisits[sortedVisits.length - 1] || null,
        lastVisit: sortedVisits[0] || null,
        isOnSiteNow: Boolean(openVisit),
      };
    });

    // Most-worked sites first; sites with no visits yet (just assigned) last.
    list.sort((a, b) => b.totalMinutes - a.totalMinutes);
    return list;
  }, [visits, assignments]);

  const totals = useMemo(
    () => ({
      distinctSites: sites.length,
      totalMinutes: sites.reduce((sum, s) => sum + s.totalMinutes, 0),
      totalVisits: sites.reduce((sum, s) => sum + s.visitCount, 0),
    }),
    [sites],
  );

  const activeSite = sites.find((s) => s.key === activeSiteKey) || null;

  return (
    <div>
      <PageHeader
        title="Sites Worked"
        subtitle="Every site you've worked at, how long you spent there, and your visit history."
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 bg-slate-100 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <SummaryCard
              icon={Layers}
              label="Distinct Sites"
              value={totals.distinctSites}
            />
            <SummaryCard
              icon={Clock}
              label="Total Hours Worked"
              value={(totals.totalMinutes / 60).toFixed(1)}
            />
            <SummaryCard
              icon={Navigation}
              label="Total Site Visits"
              value={totals.totalVisits}
            />
          </div>

          {sites.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              No site visits recorded yet. Once you check in at a site, it'll
              show up here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sites.map((site) => (
                <SiteCard
                  key={site.key}
                  site={site}
                  onClick={() => setActiveSiteKey(site.key)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <SiteDetailDrawer
        site={activeSite}
        open={Boolean(activeSite)}
        onClose={() => setActiveSiteKey(null)}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-lg font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function SiteCard({ site, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-orange-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <Building2 size={18} />
        </div>
        <div className="flex items-center gap-1.5">
          {site.isOnSiteNow && (
            <span className="text-[10px] font-medium bg-green-50 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              On site now
            </span>
          )}
          {site.isAssigned && (
            <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
              Assigned
            </span>
          )}
        </div>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-slate-800 group-hover:text-orange-600">
        {site.location_name}
      </h3>
      {site.location_code && (
        <p className="text-xs text-slate-400">{site.location_code}</p>
      )}
      {site.address && (
        <p className="text-xs text-slate-500 mt-1 flex items-start gap-1 line-clamp-2">
          <MapPin size={12} className="mt-0.5 shrink-0" />
          {site.address}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 text-sm">
        <div>
          <p className="text-[11px] text-slate-400">How long worked</p>
          <p className="font-medium text-slate-700">
            {formatDuration(site.totalMinutes)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Visits</p>
          <p className="font-medium text-slate-700">{site.visitCount}</p>
        </div>
      </div>

      {site.lastVisit && (
        <p className="text-[11px] text-slate-400 mt-2">
          Last there {formatDate(site.lastVisit.attendance_date)}
        </p>
      )}
    </button>
  );
}

function SiteDetailDrawer({ site, open, onClose }) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !site) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel — slides in from the right */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative h-full w-full max-w-md bg-white shadow-xl border-l border-slate-200 flex flex-col animate-[slideIn_0.2s_ease-out]"
      >
        <style>{`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                {site.location_name}
              </h3>
              {site.location_code && (
                <p className="text-xs text-slate-400">{site.location_code}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg p-1 -mt-1 -mr-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex-1">
          {site.address && (
            <p className="text-sm text-slate-600 flex items-start gap-1.5 mb-4">
              <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
              {site.address}
            </p>
          )}

          {site.isAssigned && (
            <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4">
              <CheckCircle2 size={13} />
              Currently assigned to you
              {site.assignedSince &&
                ` since ${formatDate(parseServerDate(site.assignedSince))}`}
              {site.radius ? ` • ${site.radius}m check-in radius` : ""}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] text-slate-400">How long worked</p>
              <p className="text-sm font-semibold text-slate-800">
                {formatDuration(site.totalMinutes)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] text-slate-400">Visits</p>
              <p className="text-sm font-semibold text-slate-800">
                {site.visitCount}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] text-slate-400">First visit</p>
              <p className="text-sm font-semibold text-slate-800">
                {site.firstVisit
                  ? formatDate(site.firstVisit.attendance_date)
                  : "—"}
              </p>
            </div>
          </div>

          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Visit history
          </h4>

          {site.visits.length === 0 ? (
            <p className="text-sm text-slate-400">
              No visits logged at this site yet.
            </p>
          ) : (
            <div className="space-y-3">
              {site.visits.map((v) => {
                const arriveLink = mapLink(
                  v.arrival_latitude,
                  v.arrival_longitude,
                );
                const departLink = mapLink(
                  v.departure_latitude,
                  v.departure_longitude,
                );
                return (
                  <div
                    key={v.id}
                    className="border border-slate-200 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <Calendar size={12} className="text-slate-400" />
                        {formatDate(v.attendance_date)}
                      </span>
                      <span className="text-xs font-medium text-orange-600">
                        {formatDuration(v.duration_minutes)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-slate-400 flex items-center gap-1">
                          <LogIn size={11} /> Arrived
                        </p>
                        <p className="font-medium text-slate-700">
                          {formatTime(v.arrival_time)}
                        </p>
                        {arriveLink && (
                          <a
                            href={arriveLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5"
                          >
                            View location <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <div>
                        <p className="text-slate-400 flex items-center gap-1">
                          <LogOut size={11} /> Departed
                        </p>
                        <p className="font-medium text-slate-700">
                          {v.departure_time
                            ? formatTime(v.departure_time)
                            : "Still on site"}
                        </p>
                        {departLink && (
                          <a
                            href={departLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5"
                          >
                            View location <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>

                    {v.notes && (
                      <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                        {v.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
