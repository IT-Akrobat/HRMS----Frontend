import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  MapPin,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import SelectDropdown from "../../components/common/SelectDropdown";
import { useToast } from "../../context/ToastContext";
import { apiClient } from "../../services/apiClient";
import { unwrap } from "../../utils/unwrap";

// ---------------------------------------------------------------------
// Manager -> "My Team" -> Team Members
//
// Two jobs on one page:
//   1. Show every direct/indirect report and whichever site(s) they're
//      currently assigned to (GET /site-assignments/my-team).
//   2. Let the manager assign a site — to one member, to a hand-picked
//      few, or to the whole team in one shot — backed by
//      POST /site-assignments/  and  POST /site-assignments/team.
//
// Site assignment only applies to Inspection/Operation field staff, who
// move between multiple sites in a day (office check-in -> arrive at
// site 1 -> arrive at site 2 -> ... -> office check-out, with time per
// site tracked automatically). Everyone else works one fixed location
// and has no use for this, so GET /site-assignments/my-team already
// filters them out server-side — this page never lists or lets you pick
// a report outside those two departments.
//
// The employee side of this (their check-in screen only offering /
// accepting their assigned site) is CheckInOutCard.jsx +
// SiteVisitCard.jsx, driven by GET /site-assignments/my.
// ---------------------------------------------------------------------

export default function TeamMembers() {
  const { showToast } = useToast();

  const [team, setTeam] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]); // employee ids checked in the table
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("selected"); // "selected" | "team"
  const [siteToAssign, setSiteToAssign] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.get("/site-assignments/my-team"),
      apiClient.get("/locations/"),
    ])
      .then(([teamRes, locRes]) => {
        setTeam(unwrap(teamRes) || []);
        setLocations(unwrap(locRes) || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function toggleSelected(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.length === team.length ? [] : team.map((t) => t.id),
    );
  }

  function openAssignModal(mode, singleEmployeeId) {
    if (singleEmployeeId) {
      setSelectedIds([singleEmployeeId]);
    }
    setModalMode(mode);
    setSiteToAssign("");
    setNotes("");
    setModalOpen(true);
  }

  async function submitAssignment() {
    if (!siteToAssign) {
      showToast({
        title: "Pick a site first",
        iconClassName: "text-orange-500 bg-orange-50",
      });
      return;
    }
    if (modalMode === "selected" && selectedIds.length === 0) {
      showToast({
        title: "Select at least one team member",
        iconClassName: "text-orange-500 bg-orange-50",
      });
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "team") {
        await apiClient.post("/site-assignments/team", {
          location_id: siteToAssign,
          notes: notes || undefined,
        });
      } else {
        await apiClient.post("/site-assignments/", {
          location_id: siteToAssign,
          employee_ids: selectedIds,
          notes: notes || undefined,
        });
      }

      showToast({
        title: "Site assigned",
        message:
          modalMode === "team"
            ? "Your whole team has been assigned to the selected site."
            : `${selectedIds.length} team member(s) assigned to the selected site.`,
        icon: CheckCircle2,
        iconClassName: "text-emerald-600 bg-emerald-50",
      });

      setModalOpen(false);
      setSelectedIds([]);
      load();
    } catch (err) {
      showToast({
        title: "Couldn't assign site",
        message: err.message,
        icon: AlertTriangle,
        iconClassName: "text-orange-500 bg-orange-50",
      });
    } finally {
      setSaving(false);
    }
  }

  const allSelected = team.length > 0 && selectedIds.length === team.length;
  const siteOptions = useMemo(
    () => locations.map((l) => ({ id: l.id, name: l.location_name })),
    [locations],
  );

  return (
    <div>
      {/* ---------- Desktop/tablet header (lg and up) — unchanged ---------- */}
      <div className="hidden lg:block">
        <PageHeader
          title="Team Members"
          subtitle="Assign a work site to your Inspection/Operation field staff — or all of them at once — for site check-in/check-out."
          actions={
            <div className="flex gap-2">
              <button
                onClick={() => openAssignModal("selected")}
                disabled={selectedIds.length === 0}
                className="flex items-center gap-1.5 border border-slate-200 text-slate-700 disabled:opacity-40 text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-slate-50"
              >
                <MapPin size={14} /> Assign Site to Selected (
                {selectedIds.length})
              </button>
              <button
                onClick={() => openAssignModal("team")}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3.5 py-2 rounded-lg"
              >
                <Users size={14} /> Assign Site to Whole Team
              </button>
            </div>
          }
        />
      </div>

      {/* ---------- Mobile header (below lg) ----------
          Title + subtitle stacked full-width (the subtitle is long and
          wrapped awkwardly next to side-by-side action buttons), then both
          actions as full-width stacked buttons underneath so they're easy
          to tap and never get squeezed. */}
      <div className="lg:hidden mb-4">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Team Members</h1>
        <p className="text-sm text-slate-500 mb-3">
          Assign a work site to your Inspection/Operation field staff — or all
          of them at once — for site check-in/check-out.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => openAssignModal("team")}
            className="flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3.5 py-2.5 rounded-lg w-full"
          >
            <Users size={14} /> Assign Site to Whole Team
          </button>
          <button
            onClick={() => openAssignModal("selected")}
            disabled={selectedIds.length === 0}
            className="flex items-center justify-center gap-1.5 border border-slate-200 text-slate-700 disabled:opacity-40 text-sm font-medium px-3.5 py-2.5 rounded-lg w-full"
          >
            <MapPin size={14} /> Assign Site to Selected ({selectedIds.length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-orange-500 flex items-center gap-2">
            <AlertTriangle size={14} /> {error}
          </div>
        ) : team.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No Inspection or Operation staff reporting to you yet. Site
            assignment only applies to field staff in those departments —
            everyone else works a single fixed location.
          </div>
        ) : (
          <>
            {/* ---------- Desktop/tablet table (lg and up) — unchanged ---------- */}
            <table className="hidden lg:table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Assigned Site(s)</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(member.id)}
                        onChange={() => toggleSelected(member.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {member.full_name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {member.employee_id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {member.designations?.designation_name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {member.assigned_sites?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {member.assigned_sites.map((site) => (
                            <span
                              key={site?.id}
                              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full"
                            >
                              <Building2 size={11} /> {site?.location_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          No site assigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openAssignModal("selected", member.id)}
                        className="text-xs font-medium text-orange-600 hover:text-orange-700"
                      >
                        Assign Site
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ---------- Mobile card list (below lg) ----------
                A wide 5-column table doesn't fit a phone screen — each
                member becomes a tappable card instead: checkbox + name up
                top, designation and site chips below, a full-width "Assign
                Site" button at the bottom instead of a small text link. */}
            <ul className="lg:hidden divide-y divide-slate-100">
              <li className="px-4 py-2.5 flex items-center gap-2.5 bg-slate-50">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300"
                />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Select All
                </span>
              </li>
              {team.map((member) => (
                <li key={member.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(member.id)}
                      onChange={() => toggleSelected(member.id)}
                      className="rounded border-slate-300 mt-1 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800 truncate">
                            {member.full_name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {member.employee_id}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {member.designations?.designation_name || "—"}
                      </div>

                      {member.assigned_sites?.length ? (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {member.assigned_sites.map((site) => (
                            <span
                              key={site?.id}
                              className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full"
                            >
                              <Building2 size={11} /> {site?.location_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-block text-xs text-slate-400 mt-2">
                          No site assigned
                        </span>
                      )}

                      <button
                        onClick={() => openAssignModal("selected", member.id)}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg"
                      >
                        <MapPin size={12} /> Assign Site
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          modalMode === "team" ? "Assign Site to Whole Team" : "Assign Site"
        }
        subtitle={
          modalMode === "team"
            ? `This will assign the selected site to all ${team.length} of your team members.`
            : `Assigning to ${selectedIds.length} selected team member(s).`
        }
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="text-sm font-medium text-slate-500 px-3.5 py-2 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={submitAssignment}
              disabled={saving}
              className="text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
            >
              {saving ? "Assigning…" : "Confirm Assignment"}
            </button>
          </>
        }
      >
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          Site
        </label>
        <SelectDropdown
          value={siteToAssign}
          onChange={setSiteToAssign}
          placeholder="Select a site…"
          options={siteOptions.map((s) => ({ value: s.id, label: s.name }))}
          className="w-full mb-4"
        />

        <label className="block text-xs font-medium text-slate-500 mb-1.5">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g. Effective from next Monday…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
        />
      </Modal>
    </div>
  );
}
