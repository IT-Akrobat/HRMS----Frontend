// import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
// import { useEffect, useState } from "react";
// import { Link, useNavigate, useSearchParams } from "react-router-dom";
// import { authService } from "../../services/authService";
// import AuthCard from "./AuthCard.jsx";

// // Landing page for the link in the Supabase recovery email:
// //   <frontend>/reset-password?token_hash=...&type=recovery
// // The token is only sent to the backend when the form is submitted, so
// // merely opening the link (or an email scanner pre-fetching it) doesn't
// // use it up.
// export default function ResetPassword() {
//   const [params] = useSearchParams();
//   const tokenHash = params.get("token_hash");
//   const navigate = useNavigate();

//   const [password, setPassword] = useState("");
//   const [confirm, setConfirm] = useState("");
//   const [showPwd, setShowPwd] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [done, setDone] = useState(false);

//   useEffect(() => {
//     if (!done) return undefined;
//     const t = setTimeout(() => navigate("/login", { replace: true }), 2500);
//     return () => clearTimeout(t);
//   }, [done, navigate]);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");

//     if (password.length < 8) {
//       setError("Password must be at least 8 characters.");
//       return;
//     }
//     if (password !== confirm) {
//       setError("Passwords do not match.");
//       return;
//     }

//     try {
//       setLoading(true);
//       await authService.resetPassword(tokenHash, password);
//       setDone(true);
//     } catch (err) {
//       const isColdStartLikely = !err.status || err.status === 502;
//       setError(
//         err.status === 429
//           ? "Too many attempts. Please wait a minute before trying again."
//           : isColdStartLikely
//             ? "Server is starting up, this can take up to a minute. Please wait and try again."
//             : err.message || "Could not reset password.",
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!tokenHash) {
//     return (
//       <AuthCard title="Invalid link">
//         <p className="text-sm text-gray-600">
//           This password reset link is missing or incomplete.
//         </p>
//         <Link
//           to="/forgot-password"
//           className="block text-center text-sm font-semibold text-orange-500 hover:text-orange-600 mt-6"
//         >
//           Request a new link
//         </Link>
//       </AuthCard>
//     );
//   }

//   if (done) {
//     return (
//       <AuthCard title="Password updated">
//         <div className="flex gap-3 rounded-2xl bg-green-50 border border-green-200 p-4">
//           <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
//           <p className="text-sm text-green-800">
//             Your password has been changed. Redirecting you to sign in...
//           </p>
//         </div>
//         <Link
//           to="/login"
//           className="block text-center text-sm font-semibold text-orange-500 hover:text-orange-600 mt-6"
//         >
//           Go to sign in
//         </Link>
//       </AuthCard>
//     );
//   }

//   const inputClass =
//     "w-full pl-12 pr-12 py-3 rounded-full border border-gray-200 focus:border-[#0b1f45] focus:ring-[#0b1f45]";

//   return (
//     <AuthCard
//       title="Set a new password"
//       subtitle="Choose a new password for your Akrobat HRMS account."
//     >
//       <form onSubmit={handleSubmit} className="space-y-4">
//         <div>
//           <label className="block text-sm font-semibold text-gray-800 mb-2">
//             New password
//           </label>
//           <div className="relative">
//             <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
//             <input
//               type={showPwd ? "text" : "password"}
//               required
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               placeholder="Enter new password"
//               autoComplete="new-password"
//               className={inputClass}
//             />
//             {password.length > 0 && (
//               <button
//                 type="button"
//                 onClick={() => setShowPwd(!showPwd)}
//                 className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
//                 aria-label={showPwd ? "Hide password" : "Show password"}
//               >
//                 {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
//               </button>
//             )}
//           </div>
//         </div>

//         <div>
//           <label className="block text-sm font-semibold text-gray-800 mb-2">
//             Confirm new password
//           </label>
//           <div className="relative">
//             <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
//             <input
//               type={showPwd ? "text" : "password"}
//               required
//               value={confirm}
//               onChange={(e) => setConfirm(e.target.value)}
//               placeholder="Re-enter new password"
//               autoComplete="new-password"
//               className={inputClass}
//             />
//           </div>
//         </div>

//         {error && <p className="text-sm text-orange-500">{error}</p>}

//         <button
//           type="submit"
//           disabled={loading}
//           className="w-full bg-[#0b1f45] hover:bg-[#0a1a3a] text-white font-semibold py-3 rounded-full shadow-lg shadow-[#0b1f45]/25 transition-colors disabled:opacity-60"
//         >
//           {loading ? "Updating..." : "Update password"}
//         </button>
//       </form>
//     </AuthCard>
//   );
// }
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../../services/authService";
import AuthCard from "./AuthCard.jsx";
import AuthField from "./Authfield.jsx";

// Landing page for the link in the Supabase recovery email:
//   <frontend>/reset-password?token_hash=...&type=recovery
// The token is only sent to the backend when the form is submitted, so
// merely opening the link (or an email scanner pre-fetching it) doesn't
// use it up.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const tokenHash = params.get("token_hash");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => navigate("/login", { replace: true }), 2500);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await authService.resetPassword(tokenHash, password);
      setDone(true);
    } catch (err) {
      const isColdStartLikely = !err.status || err.status === 502;
      setError(
        err.status === 429
          ? "Too many attempts. Please wait a minute before trying again."
          : isColdStartLikely
            ? "Server is starting up, this can take up to a minute. Please wait and try again."
            : err.message || "Could not reset password.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!tokenHash) {
    return (
      <AuthCard title="Invalid link">
        <p className="text-sm text-[#0b1f45]">
          This password reset link is missing or incomplete.
        </p>
        <Link
          to="/forgot-password"
          className="block text-center text-sm font-semibold text-brand-orange hover:underline mt-6 max-lg:text-[13px]"
        >
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <div className="flex gap-3 rounded-2xl bg-green-50 border border-green-200 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            Your password has been changed. Redirecting you to sign in...
          </p>
        </div>
        <Link
          to="/login"
          className="block text-center text-sm font-semibold text-brand-orange hover:underline mt-6 max-lg:text-[13px]"
        >
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a new password for your Akrobat HRMS account."
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-lg:space-y-3.5">
        <AuthField
          id="reset-password"
          label="New password"
          icon={Lock}
          type={showPwd ? "text" : "password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new password"
          autoComplete="new-password"
          right={
            password.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0b1f45]"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            )
          }
        />

        <AuthField
          id="reset-confirm"
          label="Confirm new password"
          icon={Lock}
          type={showPwd ? "text" : "password"}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter new password"
          autoComplete="new-password"
        />

        {error && <p className="text-sm text-orange-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#0b1f45] hover:bg-[#0a1a3a] text-white text-sm font-semibold py-3 rounded-full shadow-lg shadow-[#0b1f45]/25 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 max-lg:py-3.5 max-lg:text-base"
        >
          {loading ? "Updating..." : "Update password"}
          {!loading && <ArrowRight className="h-5 w-5 lg:hidden" />}
        </button>
      </form>
    </AuthCard>
  );
}
