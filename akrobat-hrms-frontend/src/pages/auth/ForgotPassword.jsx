import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  User,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../../services/authService";
import AuthCard from "./AuthCard.jsx";
import AuthField from "./Authfield.jsx";

// Forgot password, no email involved:
//   username + employee code  ->  backend generates a temporary password
//   and returns it ONCE  ->  user signs in with it and is sent to
//   Settings to choose their own password.
export default function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const res = await authService.forgotPassword(
        username.trim(),
        employeeCode.trim(),
      );
      setTempPassword(res.tempPassword || "");
    } catch (err) {
      const isColdStartLikely = !err.status || err.status === 502;
      setError(
        err.status === 429
          ? "Too many attempts. Please wait a minute before trying again."
          : isColdStartLikely
            ? "Server is starting up, this can take up to a minute. Please wait and try again."
            : err.message || "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (http / permissions) -- the password is
      // still on screen to read out and type.
    }
  };

  if (tempPassword) {
    return (
      <AuthCard
        title="Password reset"
        subtitle="Sign in with this temporary password, then set your own."
      >
        <div className="rounded-2xl border border-[#0b1f45]/15 bg-[#0b1f45]/5 p-4">
          <p className="text-xs font-semibold text-[#0b1f45] mb-2">
            Temporary password
          </p>
          <div className="flex items-center justify-between gap-3">
            <code className="text-lg font-semibold tracking-wider text-[#0b1f45] break-all select-all">
              {tempPassword}
            </code>
            <button
              type="button"
              onClick={copyPassword}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[#0b1f45]/20 px-3 py-1.5 text-xs font-semibold text-[#0b1f45] hover:bg-[#0b1f45]/10"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            This is shown only once. Note it down before leaving this page. You
            will be asked to change it right after you sign in.
          </p>
        </div>

        <Link
          to="/login"
          className="mt-6 flex w-full items-center justify-center gap-2 bg-[#0b1f45] hover:bg-[#0a1a3a] text-white text-sm font-semibold py-3 rounded-full shadow-lg shadow-[#0b1f45]/25 transition-colors max-lg:py-3.5 max-lg:text-base"
        >
          Go to sign in
          <ArrowRight className="h-5 w-5 lg:hidden" />
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot password?"
      subtitle="Enter your username and employee code to get a temporary password."
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-lg:space-y-3.5">
        <AuthField
          id="forgot-username"
          label="Username"
          icon={User}
          type="text"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter your username"
          autoComplete="username"
        />

        <AuthField
          id="forgot-employee-code"
          label="Employee code"
          icon={BadgeCheck}
          type="text"
          required
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          placeholder="e.g. AKR-HR-EXE-0001"
          autoComplete="off"
        />

        {error && <p className="text-sm text-orange-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#0b1f45] hover:bg-[#0a1a3a] text-white text-sm font-semibold py-3 rounded-full shadow-lg shadow-[#0b1f45]/25 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 max-lg:py-3.5 max-lg:text-base"
        >
          {loading ? "Checking..." : "Reset password"}
          {!loading && <ArrowRight className="h-5 w-5 lg:hidden" />}
        </button>
      </form>

      <Link
        to="/login"
        className="block text-center text-sm font-semibold text-brand-orange hover:underline mt-6 max-lg:text-[13px]"
      >
        Back to sign in
      </Link>
    </AuthCard>
  );
}
