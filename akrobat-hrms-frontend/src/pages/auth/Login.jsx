import { Contact, Eye, EyeOff, Lock, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/images/akrobat-logo.png"; // TODO: replace placeholder with real Akrobat logo
import slide1 from "../../assets/images/slide1.jpeg"; // TODO: replace placeholder
import slide2 from "../../assets/images/slide2.jpeg";
import slide3 from "../../assets/images/slide3.jpeg"; // TODO: replace placeholder
import { DEFAULT_ROUTE_BY_ROLE } from "../../config/roles";
import { useAuth } from "../../context/AuthContext";

const SLIDES = [slide1, slide2, slide3];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [current, setCurrent] = useState(0);
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ employeeCode: "", password: "" });
  useEffect(() => {
    const savedCode = localStorage.getItem("remember_employee_code");

    if (savedCode) {
      setEmployeeCode(savedCode);
      setRemember(true);
    }
  }, []);
  // Auto change slide every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({ employeeCode: "", password: "" });

    try {
      setLoading(true);

      // login() calls the real backend (POST /auth/login + GET /auth/me)
      // and returns the normalized user object -- role, permissions,
      // sidebar, redirect_path all come from the backend, nothing is
      // decided here. See src/services/authService.js.
      const user = await login(employeeCode, password);
      if (remember) {
        localStorage.setItem("remember_employee_code", employeeCode);
      } else {
        localStorage.removeItem("remember_employee_code");
      }
      // Prefer wherever the user was headed before being bounced to
      // /login (ProtectedRoute sets this), otherwise their role's
      // default dashboard.
      const redirectTo =
        location.state?.from?.pathname ??
        DEFAULT_ROUTE_BY_ROLE[user.role] ??
        "/";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setErrors({
        employeeCode: "",
        password: err.message || "Login failed.",
      });

      setTimeout(() => {
        setErrors({
          employeeCode: "",
          password: "",
        });
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex bg-white overflow-hidden">
      {/* LEFT -- rotating image panel */}
      <div className="relative hidden lg:flex w-1/2 h-screen overflow-hidden bg-[#0b1f45] text-white">
        {SLIDES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === current ? "opacity-40" : "opacity-0"
            }`}
          />
        ))}
        {/* dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1f45]/85 via-[#0b1f45]/70 to-[#0b1f45]/90" />

        {/* content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <img src={logo} alt="Akrobat" className="h-16 mb-10" />
            <h1 className="text-4xl font-bold tracking-wide leading-tight text-white">
              AKROBAT
              <br />
              HR MANAGEMENT SYSTEM
            </h1>
            <div className="w-16 h-1 bg-orange-500 my-6" />
            <p className="text-base text-white/85 leading-relaxed max-w-md">
              Empowering People. Strengthening Performance.
              <br />
              Smart HR solutions for a stronger tomorrow.
            </p>
          </div>

          {/* dots */}
          <div className="flex gap-2 mt-8">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? "w-8 bg-orange-500" : "w-4 bg-white/40"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          <div className="mt-8 bg-white/10 backdrop-blur-sm border border-white/15 rounded-lg p-4 max-w-xs flex gap-3">
            <Shield className="h-6 w-6 text-orange-400 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-white">
                Secure. Reliable. Compliant.
              </p>
              <p className="text-xs text-white/70 mt-0.5">
                Your data is protected with enterprise grade security.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT -- form */}
      <div className="flex-1 flex flex-col px-6 sm:px-12 lg:px-20 py-6 overflow-hidden">
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-md mx-auto py-2">
            <h2 className="text-2xl font-bold text-[#0b1f45]">Welcome Back!</h2>
            <p className="text-gray-500 mt-1">
              Sign in to continue to your Akrobat HRMS account
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Employee Code
                </label>
                <div className="relative">
                  <Contact className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    placeholder="e.g. HR-0001"
                    autoCapitalize="characters"
                    className={`w-full pl-11 pr-4 py-3 rounded-lg border transition-colors
    ${
      errors.employeeCode
        ? "border-orange-500 focus:border-orange-500 focus:ring-orange-500"
        : "border-gray-200 focus:border-[#0b1f45] focus:ring-[#0b1f45]"
    }`}
                  />
                  {errors.employeeCode && (
                    <p className="mt-2 text-sm text-orange-500">
                      {errors.employeeCode}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />

                  <input
                    type={showPwd ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`w-full pl-11 pr-11 py-3 rounded-lg border transition-colors
            ${
              errors.password
                ? "border-orange-500 focus:border-orange-500 focus:ring-orange-500"
                : "border-gray-200 focus:border-[#0b1f45] focus:ring-[#0b1f45]"
            }`}
                  />

                  {password.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  )}
                </div>

                <div className="h-5 mt-1">
                  {errors.password && (
                    <p className="text-sm text-orange-500">{errors.password}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 accent-[#0b1f45]"
                  />
                  <span className="text-sm text-gray-700">Remember me</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0b1f45] hover:bg-[#0a1a3a] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>

              <p className="text-center text-sm text-gray-600 pt-2">
                Don't have an account?{" "}
                <a
                  href="#"
                  className="text-orange-500 font-semibold hover:text-orange-600"
                >
                  Contact Administrator
                </a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
