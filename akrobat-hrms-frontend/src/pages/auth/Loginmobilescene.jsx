import { Shield } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "../../assets/images/akrobat-logo.png";
import slide1 from "../../assets/images/slide1.jpeg";
import slide2 from "../../assets/images/slide2.jpeg";
import slide3 from "../../assets/images/slide3.jpeg";

/**
 * Mobile-only hero for the Login / Forgot password pages (hidden from
 * `lg` up).
 *
 * Photo header: the rotating site photos shown crisp (no blur) in a
 * rounded-bottom header. The login card (z-10 in Login.jsx / AuthCard)
 * overlaps the bottom of the header. Logo sits on a very light translucent
 * glass box so its colours stay readable.
 */

const SLIDES = [slide1, slide2, slide3];

export default function LoginMobileScene() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative z-0 flex-1 min-h-[250px] lg:hidden">
      {/* photo header -- runs ~2.5rem under the card */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -bottom-10 overflow-hidden rounded-b-[2.5rem] bg-[#0b1f45]"
      >
        {SLIDES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === current ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1f45]/55 via-[#0b1f45]/20 to-[#0b1f45]/85" />
      </div>

      {/* content */}
      <div className="absolute inset-0 flex flex-col justify-between px-5 pb-14 pt-[max(1.5rem,calc(env(safe-area-inset-top)+0.75rem))]">
        <div className="flex items-start justify-between">
          <div className="rounded-2xl bg-white/45 px-3 py-2 backdrop-blur-sm">
            <img src={logo} alt="Akrobat" className="h-11 w-auto" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-[#0b1f45]/60 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur-sm">
            <Shield className="h-3.5 w-3.5 text-orange-400" />
            Secure login
          </span>
        </div>

        <div>
          <h1 className="max-w-[270px] text-[1.4rem] font-bold leading-tight text-white">
            Safety Builds a Stronger Tomorrow
          </h1>
          <div className="mt-2.5 h-[3px] w-10 rounded-full bg-brand-orange" />
          <div className="mt-2.5 flex items-center justify-between">
            <p className="hidden text-[12px] text-white/85 [@media(min-height:700px)]:block">
              Akrobat HR Management System
            </p>
            <div className="ml-auto flex gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === current ? "w-6 bg-orange-500" : "w-3 bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
