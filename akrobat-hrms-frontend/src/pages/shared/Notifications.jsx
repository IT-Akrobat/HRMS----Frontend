import NotificationsPage from "../../components/common/Notificationpage";
import { ROLES } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";

// One shared Notifications page for every role instead of four near-copies
// (previously: Employee/Manager used <NotificationsPage> with slightly
// different props, HR Admin/Super Admin just showed an empty
// PlaceholderPage). NotificationsPage itself already only depends on
// GET/PUT/DELETE /notifications/... which works the same for any logged-in
// user, so the only thing that ever varied per role was this config —
// the subtitle text and which page the "pending approvals" tile links to.
const ROLE_CONFIG = {
  [ROLES.EMPLOYEE]: {
    subtitle: "Approvals, updates, and announcements — all in one place.",
  },
  [ROLES.MANAGER]: {
    subtitle: "New leave requests from your team and other updates.",
    reviewLink: "/manager/leave/pending",
    reviewLabel: "Pending Leave Approvals",
  },
  [ROLES.HR_ADMIN]: {
    subtitle: "Leave requests, approvals, and company-wide announcements.",
    reviewLink: "/hr-admin/leave/requests",
    reviewLabel: "Leave Requests To Review",
  },
  [ROLES.SUPER_ADMIN]: {
    subtitle: "Leave requests, system alerts, and account activity.",
    reviewLink: "/super-admin/leave/requests",
    reviewLabel: "Leave Requests To Review",
  },
};

export default function Notifications() {
  const { role } = useAuth();
  const config = ROLE_CONFIG[role] || ROLE_CONFIG[ROLES.EMPLOYEE];

  return (
    <NotificationsPage
      subtitle={config.subtitle}
      reviewLink={config.reviewLink}
      reviewLabel={config.reviewLabel}
    />
  );
}
