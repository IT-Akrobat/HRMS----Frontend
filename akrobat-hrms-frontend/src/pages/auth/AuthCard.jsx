import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "../../assets/images/akrobat-logo.png";
import slide1 from "../../assets/images/slide1.jpeg";
import slide2 from "../../assets/images/slide2.jpeg";
import slide3 from "../../assets/images/slide3.jpeg";
import LoginMobileScene from "./Loginmobilescene";

const SLIDES = [slide1, slide2, slide3];

// Shared shell for the pre-login pages (Forgot / Reset password).
// Same layout as Login.jsx: climbing-worker scene + bottom sheet on
// mobile, rotating slide panel + floating card on desktop.
export default function AuthCard({ title, subtitle, children }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-screen w-full flex bg-white overflow-hidden max-lg:h-[100dvh] max-lg:flex-col max-lg:bg-[linear-gradient(180deg,#8dc2f1_0%,#b9dbf7_38%,#e1f0fc_72%,#eaf4fd_100%)]">
      {/* MOBILE -- sky, wall, ladder and the climbing worker */}
      <LoginMobileScene />

      {/* LEFT -- rotating image panel (desktop) */}
      <div className="relative isolate hidden lg:flex lg:w-[calc(72%-138px)] h-screen overflow-hidden bg-[#0b1f45] text-white">
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
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1f45]/85 via-[#0b1f45]/70 to-[#0b1f45]/90" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <img src={logo} alt="Akrobat" className="h-16 mb-10" />
            <h1 className="text-3xl xl:text-4xl font-bold tracking-wide leading-tight text-white">
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

      {/* RIGHT -- card */}
      <div className="flex-1 flex flex-col px-6 sm:px-12 py-6 overflow-hidden lg:contents max-lg:relative max-lg:z-10 max-lg:flex-none max-lg:mx-3.5 max-lg:mb-3.5 max-lg:rounded-[2rem] max-lg:bg-white/90 max-lg:px-6 max-lg:pt-7 max-lg:pb-3 max-lg:backdrop-blur-xl max-lg:shadow-[0_20px_60px_rgba(11,31,69,0.22)] max-lg:max-h-[78dvh] max-lg:overflow-y-auto">
        <div className="flex-1 flex flex-col justify-start lg:justify-center lg:items-center max-lg:flex-none">
          <div className="w-full max-w-md mx-auto lg:z-20 lg:absolute lg:top-1/2 lg:-translate-y-1/2 lg:left-[72%] lg:-translate-x-1/2 lg:w-[460px] lg:max-w-none lg:mx-0 lg:pt-10 lg:pb-8 lg:px-14 lg:bg-white lg:rounded-[4rem] lg:shadow-[0_25px_70px_rgba(11,31,69,0.3)]">
            <h2 className="text-xl font-bold text-[#0b1f45] max-lg:font-display max-lg:text-[1.6rem] max-lg:leading-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-[#0b1f45] mt-1 max-lg:text-[13px]">
                {subtitle}
              </p>
            )}
            <div className="mt-6 max-lg:mt-5">{children}</div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pb-2 max-lg:pt-4 max-lg:pb-1 max-lg:text-[12px] lg:absolute lg:bottom-5 lg:left-[72%] lg:-translate-x-1/2 lg:w-[460px] lg:pb-0">
          © {new Date().getFullYear()} Akrobat. All rights reserved.
        </p>
      </div>
    </div>
  );
}
