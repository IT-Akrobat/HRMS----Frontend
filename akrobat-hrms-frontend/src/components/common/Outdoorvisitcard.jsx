import { LogIn, LogOut, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Ad-hoc "checking in from a meeting/site" — for employees who are NOT
// pre-assigned to any fixed site (that's SiteVisitCard's job). Only
// ever rendered when user.profile.outdoor_checkin_enabled is true (see
// app/auth/services.py::get_me) — everyone else never sees this card
// exist, by design: most employees in every department never need it,
// and it's HR who turns it on per-person, not a role/department switch.
//
// No location picker here on purpose — these places (a client's
// office, a one-off site survey address) aren't in the company's
// `locations` list, so we just grab GPS + let the employee type what
// it's for. Backed by app/attendance/services.py's
// arrive_at_outdoor_visit / depart_outdoor_visit (attendance_outdoor_visits
// table — see sql/030.sql).
// ---------------------------------------------------------------------

function formatTime(iso) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OutdoorVisitCard({
  checkedIn,
  checkedOut,
  onActivityChange,
} = {}) {
  const [visits, setVisits] = useState([]);
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const openVisit = visits.find((v) => !v.departure_time);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(id);
  }, [error]);

  function load() {
    setLoading(true);
    apiClient
      .get("/attendance/outdoor-visit/today")
      .then((res) => setVisits(res?.data ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedIn, checkedOut]);

  function withPosition(cb) {
    if (!navigator.geolocation) {
      setError("Location isn't available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => cb(pos.coords.latitude, pos.coords.longitude),
      () =>
        setError("Couldn't get your location. Enable location and try again."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function handleArrive() {
    setBusy(true);
    withPosition((latitude, longitude) => {
      apiClient
        .post("/attendance/outdoor-visit/arrive", {
          latitude,
          longitude,
          purpose: purpose || null,
        })
        .then(() => {
          setPurpose("");
          load();
          onActivityChange?.();
        })
        .catch((err) => setError(err.message))
        .finally(() => setBusy(false));
    });
  }

  function handleDepart() {
    setBusy(true);
    withPosition((latitude, longitude) => {
      apiClient
        .post("/attendance/outdoor-visit/depart", { latitude, longitude })
        .then(() => {
          load();
          onActivityChange?.();
        })
        .catch((err) => setError(err.message))
        .finally(() => setBusy(false));
    });
  }

  return (
    <div className="rounded-[13px] bg-white p-4 h-full flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <MapPin size={16} className="text-orange-500" />
        Checking in from a meeting/site
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {!openVisit ? (
        <>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="What's this for? (e.g. Client meeting)"
            className="text-sm rounded-lg border border-slate-200 px-3 py-2"
          />
          <button
            type="button"
            disabled={busy || checkedOut}
            onClick={handleArrive}
            className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 text-white text-sm font-semibold py-2 disabled:opacity-50"
          >
            <LogIn size={16} /> Check in from here
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={handleDepart}
          className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 text-white text-sm font-semibold py-2 disabled:opacity-50"
        >
          <LogOut size={16} /> Back to normal / done
        </button>
      )}

      {!loading && visits.length > 0 && (
        <div className="text-xs text-slate-500 space-y-1">
          {visits.map((v) => (
            <div key={v.id} className="flex justify-between">
              <span>{v.purpose || "Outdoor check-in"}</span>
              <span>
                {formatTime(v.arrival_time)}
                {v.departure_time
                  ? ` – ${formatTime(v.departure_time)}`
                  : " – now"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
