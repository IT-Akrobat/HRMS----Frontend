import {
  AlertTriangle,
  Aperture,
  Briefcase,
  Building2,
  Camera,
  Check,
  Droplet,
  Edit3,
  FileText,
  Heart,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Upload,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Modal from "../../components/common/Modal";
import PageHeader from "../../components/common/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../services/apiClient";

// ============================================================================
// My Profile — shared across every role (Employee, Manager, HR Admin,
// Super Admin). Opened from the header's profile dropdown ("My Profile").
// ============================================================================
//
// Backed by what actually exists in the API today:
//   GET /auth/me        -> name, email, role, employee_id, phone, photo,
//                           joining_date, employment_status (app/auth/schemas.py MeResponse/MeProfile)
//   GET /documents/my    -> this user's own documents (app/documents/routes.py)
//
// NOT backed by any table/endpoint yet, so these are stored locally
// (per-user, in localStorage) exactly like emergency contacts already were,
// until real endpoints ship:
//   - profile photo (no storage endpoint — the camera badge opens a popup
//     that can capture a live shot via getUserMedia or accept a file
//     upload; either way the image is resized/compressed client-side and
//     kept on this device only, as a data URL)
//   - date_of_birth, gender, marital_status, nationality, blood_group,
//     address (none of these columns exist on `employees` — see
//     sql/001_schema.sql)
//   - bank details (no bank_details table anywhere in the schema)
//
// Swap the loadLocal*/saveLocal* helpers below for real apiClient calls
// once those endpoints exist — everything else in this file is unaffected.

const LOCAL_CONTACTS_PREFIX = "akrobat_emergency_contacts_";
const LOCAL_EXTRA_PREFIX = "akrobat_profile_extra_";
const LOCAL_PHOTO_PREFIX = "akrobat_profile_photo_";

function loadLocalJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocalJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Camera captures and phone-camera uploads can easily be several MB and
// several thousand pixels wide — localStorage's ~5MB-per-origin quota
// (shared with every other key this app writes) can't absorb that. Scale
// down to a sensible avatar size and re-encode as JPEG before it's ever
// handed to localStorage, regardless of whether the image came from the
// file picker or the live camera.
function resizeImageDataUrl(dataUrl, maxDim = 640, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not process that image."));
    img.src = dataUrl;
  });
}

const TABS = [
  { key: "personal", label: "Personal Details", icon: User },
  { key: "job", label: "Job Details", icon: Briefcase },
  { key: "bank", label: "Bank Details", icon: Shield },
  { key: "emergency", label: "Emergency Contact", icon: Heart },
];

// Fields not yet stored on the backend `employees` table. Editable through
// the popup and persisted locally until a real column/endpoint exists.
const EXTRA_FIELDS = [
  { key: "date_of_birth", label: "Date of Birth", type: "date" },
  {
    key: "gender",
    label: "Gender",
    type: "select",
    options: ["Male", "Female", "Other"],
  },
  {
    key: "marital_status",
    label: "Marital Status",
    type: "select",
    options: ["Single", "Married", "Divorced", "Widowed"],
  },
  { key: "nationality", label: "Nationality", type: "text" },
  {
    key: "blood_group",
    label: "Blood Group",
    type: "select",
    options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  },
  { key: "address", label: "Address", type: "textarea" },
];

const EMPTY_CONTACT = { name: "", relation: "", phone: "" };

export default function MyProfile() {
  const { user } = useAuth();

  const [profile, setProfile] = useState(null); // MeResponse from /auth/me
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("personal");

  const [contacts, setContacts] = useState([]);
  const [photoOverride, setPhotoOverride] = useState(null);
  const [extra, setExtra] = useState({});

  // ---- Edit Profile popup ----
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);

  // ---- Profile photo (capture / upload) popup ----
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  // ---- Emergency contact popup ----
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [contactDraft, setContactDraft] = useState(EMPTY_CONTACT);

  useEffect(() => {
    apiClient
      .get("/auth/me")
      .then((res) => {
        const data = res.data || res; // success_response wraps as { data: MeResponse }
        setProfile(data);
      })
      .catch((err) => setError(err.message || "Could not load your profile."))
      .finally(() => setLoading(false));

    apiClient
      .get("/documents/my")
      .then((res) => setDocuments(res.data || res || []))
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false));
  }, []);

  const empId = profile?.profile?.employee_id || profile?.id || user?.id;

  useEffect(() => {
    if (!empId) return;
    setContacts(loadLocalJSON(`${LOCAL_CONTACTS_PREFIX}${empId}`, []));
    setExtra(loadLocalJSON(`${LOCAL_EXTRA_PREFIX}${empId}`, {}));
    setPhotoOverride(
      localStorage.getItem(`${LOCAL_PHOTO_PREFIX}${empId}`) || null,
    );
  }, [empId]);

  // ---------------- Edit Profile popup ----------------
  function openEditModal() {
    setEditDraft({
      phone: profile?.profile?.phone || "",
      ...extra,
    });
    setError("");
    setEditOpen(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    setError("");
    try {
      // There is no self-service PATCH /auth/me or /employees/me today —
      // updating an employee record requires the EDIT_EMPLOYEE permission,
      // which most roles here don't hold for their own record
      // (app/employees/routes.py). Phone is the one field we can
      // realistically ship without a backend change by routing it through
      // that same admin endpoint once a "self" exception is added there.
      // Left commented so wiring it up later is a one-line change:
      //
      // await apiClient.put(`/employees/${empId}`, { phone: editDraft.phone });

      setProfile((prev) => ({
        ...prev,
        profile: { ...prev.profile, phone: editDraft.phone },
      }));

      const { phone, ...extraOnly } = editDraft;
      setExtra(extraOnly);
      if (empId) saveLocalJSON(`${LOCAL_EXTRA_PREFIX}${empId}`, extraOnly);

      setEditOpen(false);
    } catch (err) {
      setError(err.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  // ---------------- Photo (capture / upload) ----------------
  // No profile-photo storage endpoint exists yet (see file banner) — this
  // resizes/compresses whatever comes in (camera capture or file upload)
  // and keeps it on this device, exactly like the rest of the "local
  // until the backend exists" fields above.
  async function savePhoto(rawDataUrl) {
    const resized = await resizeImageDataUrl(rawDataUrl);
    setPhotoOverride(resized);
    if (empId) {
      try {
        localStorage.setItem(`${LOCAL_PHOTO_PREFIX}${empId}`, resized);
      } catch {
        throw new Error(
          "Could not save that photo on this device — storage is full.",
        );
      }
      window.dispatchEvent(new Event("akrobat:profile-photo-updated"));
    }
  }

  // ---------------- Emergency contacts popup ----------------
  function openAddContact() {
    setEditingContactId(null);
    setContactDraft(EMPTY_CONTACT);
    setContactModalOpen(true);
  }

  function openEditContact(c) {
    setEditingContactId(c.id);
    setContactDraft({
      name: c.name,
      relation: c.relation || "",
      phone: c.phone,
    });
    setContactModalOpen(true);
  }

  function handleSaveContact(e) {
    e.preventDefault();
    if (!contactDraft.name || !contactDraft.phone) return;

    let updated;
    if (editingContactId) {
      updated = contacts.map((c) =>
        c.id === editingContactId ? { ...c, ...contactDraft } : c,
      );
    } else {
      updated = [...contacts, { ...contactDraft, id: crypto.randomUUID() }];
    }

    setContacts(updated);
    if (empId) saveLocalJSON(`${LOCAL_CONTACTS_PREFIX}${empId}`, updated);
    setContactModalOpen(false);
  }

  function handleRemoveContact(id) {
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    if (empId) saveLocalJSON(`${LOCAL_CONTACTS_PREFIX}${empId}`, updated);
  }

  const docSummary = {
    total: documents.length,
    expiringSoon: documents.filter((d) => {
      const days = daysUntil(d.expiry_date);
      return days !== null && days >= 0 && days <= 30;
    }).length,
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title="My Profile"
          subtitle="View and manage your personal and professional information."
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const p = profile?.profile || {};
  const name = profile?.name || user?.name || "—";
  const employeeId = p.employee_id || "—";
  const role = profile?.role || user?.role || "—";
  const department = profile?.department?.name || "—";
  const photoSrc = photoOverride || p.profile_photo;

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="View and manage your personal and professional information."
        actions={
          <button
            onClick={openEditModal}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            <Edit3 size={15} /> Edit Profile
          </button>
        }
      />

      {error && (
        <div className="mb-4 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-orange-400 hover:text-orange-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---------------- Main column ---------------- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-semibold overflow-hidden">
                  {photoSrc ? (
                    <img
                      src={photoSrc}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                  )}
                </div>
                <button
                  onClick={() => setPhotoModalOpen(true)}
                  title="Change profile photo"
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700"
                >
                  <Camera size={12} />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-800">
                    {name}
                  </h2>
                  <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    {p.employment_status || "Active"}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {employeeId} • {role}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-1 flex items-center gap-1">
                  <Building2 size={12} /> Department
                </p>
                <p className="text-slate-700 font-medium">{department}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1 flex items-center gap-1">
                  <Mail size={12} /> Email
                </p>
                <p className="text-slate-700 font-medium truncate">
                  {profile?.email || "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1 flex items-center gap-1">
                  <Phone size={12} /> Phone
                </p>
                <p className="text-slate-700 font-medium">{p.phone || "—"}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Joined On</p>
                <p className="text-slate-700 font-medium">
                  {formatDate(p.joining_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="flex border-b border-slate-100 overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-orange-500 text-orange-600"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Icon size={14} /> {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {activeTab === "personal" && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Full Name" value={name} />
                    <Field label="Employee ID" value={employeeId} />
                    <Field label="Email Address" value={profile?.email} />
                    <Field label="Phone Number" value={p.phone} />
                    <Field
                      label="Date of Birth"
                      value={formatDate(extra.date_of_birth)}
                    />
                    <Field label="Gender" value={extra.gender} />
                    <Field
                      label="Marital Status"
                      value={extra.marital_status}
                    />
                    <Field label="Nationality" value={extra.nationality} />
                    <Field label="Blood Group" value={extra.blood_group} />
                    <Field label="Address" value={extra.address} />
                  </div>

                  <button
                    onClick={openEditModal}
                    className="mt-5 flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700"
                  >
                    <Pencil size={14} /> Edit these details
                  </button>
                </div>
              )}

              {activeTab === "job" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Designation" value={role} />
                  <Field label="Department" value={department} />
                  <Field
                    label="Employment Status"
                    value={p.employment_status}
                  />
                  <Field
                    label="Joining Date"
                    value={formatDate(p.joining_date)}
                  />
                  <Field label="Work Location" value={profile?.branch?.name} />
                  <Field
                    label="Reporting Manager"
                    value={profile?.department?.manager_name}
                  />
                </div>
              )}

              {activeTab === "bank" && (
                <div className="flex items-start gap-2 text-sm text-slate-600 bg-orange-50 border border-orange-100 rounded-lg p-4">
                  <Shield
                    size={16}
                    className="mt-0.5 text-orange-500 shrink-0"
                  />
                  <div>
                    <p className="font-medium text-slate-700">
                      Bank details aren't stored in Akrobat HRMS yet.
                    </p>
                    <p className="text-slate-500 mt-1">
                      There's no bank-details table in the schema today. Please
                      share updates with HR / Payroll directly until
                      self-service bank detail management ships.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "emergency" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-500">
                      Stored on this device only — not synced with HR yet.
                    </p>
                    <button
                      onClick={openAddContact}
                      className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
                    >
                      <Plus size={13} /> Add Contact
                    </button>
                  </div>

                  {contacts.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No emergency contacts added yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {contacts.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              {c.name}{" "}
                              {c.relation && (
                                <span className="text-slate-400 font-normal">
                                  ({c.relation})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">{c.phone}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openEditContact(c)}
                              className="text-slate-400 hover:text-orange-600"
                              title="Edit contact"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleRemoveContact(c.id)}
                              className="text-slate-400 hover:text-orange-500"
                              title="Remove contact"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <User size={16} className="text-orange-500" /> Personal
              Information
            </h3>
            <dl className="space-y-3 text-sm">
              <Row
                icon={MapPin}
                label="Work Location"
                value={profile?.branch?.name}
              />
              <Row icon={Droplet} label="Employee ID" value={employeeId} />
              <Row
                icon={Briefcase}
                label="Employment Status"
                value={p.employment_status}
              />
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Heart size={16} className="text-orange-500" /> Emergency
                Contacts
              </h3>
              <button
                onClick={() => setActiveTab("emergency")}
                className="text-xs text-orange-600 font-medium"
              >
                View All
              </button>
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-slate-400">None added yet.</p>
            ) : (
              <ul className="space-y-3">
                {contacts.slice(0, 2).map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold">
                      {c.name[0]}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-slate-700">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.phone}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={16} className="text-orange-500" /> Documents
                Summary
              </h3>
            </div>
            {docsLoading ? (
              <div className="h-16 bg-slate-100 rounded animate-pulse" />
            ) : (
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-slate-700">
                    {docSummary.total}
                  </div>
                  <div className="text-xs text-slate-400">Total Documents</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-orange-500">
                    {docSummary.expiringSoon}
                  </div>
                  <div className="text-xs text-slate-400">Expiring Soon</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- Profile Photo popup (capture / upload) ---------------- */}
      <ProfilePhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        currentPhoto={photoSrc}
        initials={name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")}
        onSave={savePhoto}
      />

      {/* ---------------- Edit Profile popup ---------------- */}
      <Modal
        open={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        title="Edit Profile"
        subtitle="Update your contact and personal details."
        footer={
          <>
            <button
              onClick={() => setEditOpen(false)}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              <X size={15} /> Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg px-3 py-2"
            >
              <Save size={15} /> {saving ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs text-slate-500 mb-1 block">
              Phone Number
            </label>
            <input
              value={editDraft.phone || ""}
              onChange={(e) =>
                setEditDraft((d) => ({ ...d, phone: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. +91 98765 43210"
            />
          </div>

          {EXTRA_FIELDS.map((f) => (
            <div
              key={f.key}
              className={f.type === "textarea" ? "md:col-span-2" : ""}
            >
              <label className="text-xs text-slate-500 mb-1 block">
                {f.label}
              </label>
              {f.type === "select" ? (
                <select
                  value={editDraft[f.key] || ""}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select…</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  value={editDraft[f.key] || ""}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  rows={2}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none"
                />
              ) : (
                <input
                  type={f.type}
                  value={editDraft[f.key] || ""}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
          <Shield size={13} className="mt-0.5 shrink-0" />
          <p>
            Phone number updates sync with HR once saved. Date of birth, gender,
            marital status, nationality, blood group and address are saved to
            this device until self-service editing for those fields is connected
            to the server.
          </p>
        </div>
      </Modal>

      {/* ---------------- Emergency Contact popup ---------------- */}
      <Modal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title={
          editingContactId ? "Edit Emergency Contact" : "Add Emergency Contact"
        }
        footer={
          <>
            <button
              onClick={() => setContactModalOpen(false)}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              <X size={15} /> Cancel
            </button>
            <button
              form="emergency-contact-form"
              type="submit"
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-3 py-2"
            >
              <Save size={15} /> Save Contact
            </button>
          </>
        }
      >
        <form
          id="emergency-contact-form"
          onSubmit={handleSaveContact}
          className="grid grid-cols-1 gap-3"
        >
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Name</label>
            <input
              required
              value={contactDraft.name}
              onChange={(e) =>
                setContactDraft((c) => ({ ...c, name: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              placeholder="Contact's full name"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Relation
            </label>
            <input
              value={contactDraft.relation}
              onChange={(e) =>
                setContactDraft((c) => ({ ...c, relation: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. Spouse, Parent, Sibling"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Phone Number
            </label>
            <input
              required
              value={contactDraft.phone}
              onChange={(e) =>
                setContactDraft((c) => ({ ...c, phone: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. +91 98765 43210"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ============================================================================
// Profile photo popup — capture a photo live with the device camera, or
// upload one from disk. Both paths land in the same preview step so the
// person can retake/re-choose before it's actually saved.
// ============================================================================
function ProfilePhotoModal({ open, onClose, currentPhoto, initials, onSave }) {
  const [mode, setMode] = useState("choose"); // choose | camera | preview
  const [captured, setCaptured] = useState(null); // data URL, pre-resize
  const [cameraError, setCameraError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function resetAndClose() {
    stopCamera();
    setMode("choose");
    setCaptured(null);
    setCameraError("");
    setSaveError("");
    onClose();
  }

  async function startCamera() {
    setCameraError("");
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      stopCamera();
      setMode("choose");
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Camera access was blocked. Allow camera access for this site, or upload a photo instead."
          : err?.name === "NotFoundError"
            ? "No camera was found on this device. Try uploading a photo instead."
            : "Couldn't start the camera. Try uploading a photo instead.",
      );
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.92));
    stopCamera();
    setMode("preview");
  }

  function handleFilePick(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSaveError("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setSaveError("Image is too large — please choose one under 8MB.");
      return;
    }
    setSaveError("");
    const reader = new FileReader();
    reader.onload = () => {
      setCaptured(reader.result);
      setMode("preview");
    };
    reader.onerror = () =>
      setSaveError("Could not read that image, please try another.");
    reader.readAsDataURL(file);
  }

  function retake() {
    setCaptured(null);
    setSaveError("");
    setMode("choose");
  }

  async function confirmSave() {
    if (!captured) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSave(captured);
      resetAndClose();
    } catch (err) {
      setSaveError(err.message || "Could not save that photo.");
    } finally {
      setSaving(false);
    }
  }

  // Release the camera if the modal is closed/unmounted while it's live.
  useEffect(() => stopCamera, []);

  return (
    <Modal
      open={open}
      onClose={() => !saving && resetAndClose()}
      title="Update Profile Photo"
      subtitle="Take a new photo with your camera, or upload one from your device."
      width="max-w-md"
      footer={
        mode === "preview" ? (
          <>
            <button
              onClick={retake}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              <RotateCcw size={14} /> Choose Again
            </button>
            <button
              onClick={confirmSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg px-3 py-2"
            >
              <Check size={15} /> {saving ? "Saving..." : "Use This Photo"}
            </button>
          </>
        ) : (
          <button
            onClick={resetAndClose}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            <X size={15} /> Cancel
          </button>
        )
      }
    >
      {saveError && (
        <div className="mb-4 flex items-start gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {saveError}
        </div>
      )}

      {mode === "choose" && (
        <div>
          {cameraError && (
            <div className="mb-4 flex items-start gap-2 text-sm text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {cameraError}
            </div>
          )}

          <div className="flex justify-center mb-5">
            <div className="w-24 h-24 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-2xl font-semibold overflow-hidden">
              {currentPhoto ? (
                <img
                  src={currentPhoto}
                  alt="Current"
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={startCamera}
              className="flex flex-col items-center gap-2 border border-slate-200 hover:border-orange-300 hover:bg-orange-50 rounded-xl px-4 py-5 transition-colors"
            >
              <Aperture size={22} className="text-orange-500" />
              <span className="text-sm font-medium text-slate-700">
                Take Photo
              </span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 border border-slate-200 hover:border-orange-300 hover:bg-orange-50 rounded-xl px-4 py-5 transition-colors"
            >
              <Upload size={22} className="text-orange-500" />
              <span className="text-sm font-medium text-slate-700">
                Upload Photo
              </span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFilePick}
          />
        </div>
      )}

      {mode === "camera" && (
        <div>
          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-square">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
          </div>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => {
                stopCamera();
                setMode("choose");
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              <X size={15} /> Cancel
            </button>
            <button
              onClick={capturePhoto}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-4 py-2"
            >
              <Camera size={15} /> Capture
            </button>
          </div>
        </div>
      )}

      {mode === "preview" && captured && (
        <div className="flex justify-center">
          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-slate-100">
            <img
              src={captured}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value || "—"}</p>
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-slate-400">
        <Icon size={13} /> {label}
      </span>
      <span className="font-medium text-slate-700">{value || "—"}</span>
    </div>
  );
}
