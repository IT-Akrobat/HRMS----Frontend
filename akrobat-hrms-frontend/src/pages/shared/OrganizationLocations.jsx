import {
  AlertTriangle,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import LocationMapPicker from "../../components/common/LocationMapPicker";
import PageHeader from "../../components/common/PageHeader";
import { apiClient } from "../../services/apiClient";

// ---------------------------------------------------------------------
// Wired to the real backend: GET/POST/PUT/DELETE /locations, matching
// app/locations/{routes,services,schemas}.py. A "location" here is a
// company site (office, project site, warehouse, etc.) with a lat/lng +
// geofence radius, used elsewhere in the app for check-in/check-out and
// site visits (see components/common/SiteVisitCard.jsx).
// ---------------------------------------------------------------------

function Field({ label, required, error, children, hint }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">
        {label} {required && <span className="text-orange-500">*</span>}
      </span>
      {children}
      {hint && !error && (
        <span className="text-xs text-slate-400 mt-1 block">{hint}</span>
      )}
      {error && (
        <span className="text-xs text-orange-500 mt-1 block">{error}</span>
      )}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400";

// ==========================================================================
// Add / Edit modal — this is the "New Site" flow: name/code/radius fields
// plus the map picker for choosing the site's coordinates by searching or
// clicking on the map (auto-detects the browser's current location when
// adding a new site, defaulting to Singapore if that isn't available).
// ==========================================================================

function LocationFormModal({ mode, location, onClose, onSaved }) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState(() => ({
    location_name: location?.location_name || "",
    location_code: location?.location_code || "",
    address: location?.address || "",
    latitude: typeof location?.latitude === "number" ? location.latitude : null,
    longitude:
      typeof location?.longitude === "number" ? location.longitude : null,
    radius: location?.radius ?? 100,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.location_name.trim()) {
      setError("Site name is required.");
      return;
    }
    if (!form.location_code.trim()) {
      setError("Site code is required.");
      return;
    }
    if (
      typeof form.latitude !== "number" ||
      typeof form.longitude !== "number"
    ) {
      setError("Please pick the site's location on the map.");
      return;
    }
    if (!form.radius || Number(form.radius) <= 0) {
      setError("Geofence radius must be a positive number of meters.");
      return;
    }

    const payload = {
      location_name: form.location_name.trim(),
      location_code: form.location_code.trim(),
      address: form.address.trim(),
      latitude: form.latitude,
      longitude: form.longitude,
      radius: Number(form.radius),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await apiClient.put(`/locations/${location.id}`, payload);
      } else {
        await apiClient.post("/locations/", payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {isEdit ? "Edit Site" : "New Site"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? `Update details for ${location?.location_name}`
                : "Add a new office or work site, and choose its location on the map."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto px-6 py-5 space-y-6"
        >
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-100 text-orange-600 text-sm px-3 py-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Site Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Site Name" required>
                <input
                  className={inputCls}
                  value={form.location_name}
                  onChange={(e) => set("location_name", e.target.value)}
                  placeholder="e.g. Marina Bay Office"
                />
              </Field>
              <Field label="Site Code" required>
                <input
                  className={inputCls}
                  value={form.location_code}
                  onChange={(e) => set("location_code", e.target.value)}
                  placeholder="e.g. SG-MB-01"
                />
              </Field>
              <Field
                label="Geofence Radius (meters)"
                required
                hint="Employees must be within this radius of the pin to check in."
              >
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  value={form.radius}
                  onChange={(e) => set("radius", e.target.value)}
                  placeholder="100"
                />
              </Field>
              <Field label="Address">
                <input
                  className={inputCls}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Auto-filled from the map, or type your own"
                />
              </Field>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Location on Map
            </h3>
            <LocationMapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(lat, lng) => {
                set("latitude", lat);
                set("longitude", lng);
              }}
              onAddressResolved={(address) => {
                // Only auto-fill if the user hasn't already typed their
                // own address, so we never clobber a manual edit.
                setForm((f) => (f.address.trim() ? f : { ...f, address }));
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? "Save Changes" : "Create Site"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================================================
// Delete confirm
// ==========================================================================

function DeleteConfirmModal({ location, deleting, error, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Delete Site</h2>
        <p className="text-sm text-slate-500 mb-4">
          Are you sure you want to delete{" "}
          <span className="font-medium text-slate-700">
            {location?.location_name}
          </span>
          ? This action cannot be undone.
        </p>
        {error && (
          <div className="text-xs text-orange-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 flex items-center gap-2"
          >
            {deleting && <Loader2 size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Main page
// ==========================================================================

export default function OrganizationLocations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState("");

  const [formState, setFormState] = useState(null); // { mode: 'add'|'edit', location }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Deep link from elsewhere in the app (e.g. the Super Admin dashboard's
  // "New Site" quick action) straight into the create flow.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setFormState({ mode: "add" });
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadLocations() {
    setLoading(true);
    setLoadError(null);
    return apiClient
      .get("/locations/")
      .then((res) => setLocations(res.data || []))
      .catch((err) => {
        setLocations([]);
        setLoadError(err.message || "Could not load sites.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadLocations();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter((loc) =>
      `${loc.location_name} ${loc.location_code} ${loc.address || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [locations, search]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete(`/locations/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadLocations();
    } catch (err) {
      setDeleteError(err.message || "Could not delete this site.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Locations"
        subtitle="Manage your organization's sites and their check-in geofences."
        actions={
          <button
            onClick={() => setFormState({ mode: "add" })}
            className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium flex items-center gap-1.5"
          >
            <Plus size={15} />
            New Site
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by site name, code or address..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loadError && (
          <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border-b border-orange-100 px-4 py-3 text-sm">
            <AlertTriangle size={16} />
            {loadError}
          </div>
        )}

        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Address</th>
                <th className="px-4 py-3 font-medium">Coordinates</th>
                <th className="px-4 py-3 font-medium">Radius</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400 text-sm"
                  >
                    No sites found. Click "New Site" to add your first location.
                  </td>
                </tr>
              ) : (
                filtered.map((loc) => (
                  <tr
                    key={loc.id}
                    className="border-b border-slate-50 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                          <MapPin size={16} />
                        </div>
                        <div className="font-medium text-slate-800 truncate">
                          {loc.location_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {loc.location_code || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {loc.address || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {typeof loc.latitude === "number" &&
                      typeof loc.longitude === "number"
                        ? `${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {loc.radius ? `${loc.radius} m` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            setFormState({ mode: "edit", location: loc })
                          }
                          title="Edit"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(loc);
                          }}
                          title="Delete"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-orange-50 hover:text-orange-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formState && (
        <LocationFormModal
          mode={formState.mode}
          location={formState.location}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            loadLocations();
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          location={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
