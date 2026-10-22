import logo from "../../assets/images/akrobat-logo.png";

// Shared shell for the pre-login "Forgot password" page. Uses the same
// navy + orange palette and pill inputs as Login.jsx so the flow feels
// like part of the same screen.
export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0b1f45] px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.35)] px-8 sm:px-12 py-10">
        <img src={logo} alt="Akrobat" className="h-12 mb-6" />
        <h2 className="text-2xl font-bold text-[#0b1f45]">{title}</h2>
        {subtitle && <p className="text-gray-500 mt-1 text-sm">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} Akrobat. All rights reserved.
        </p>
      </div>
    </div>
  );
}
