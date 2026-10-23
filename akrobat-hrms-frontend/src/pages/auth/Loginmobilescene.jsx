import { useEffect, useState } from "react";
import logo from "../../assets/images/akrobat-logo.png";

/**
 * Mobile-only hero for the Login page (hidden from `lg` up).
 *
 * Sky + blue wall + rope ladder + a safety worker who climbs the ladder
 * up, pauses, climbs back down and repeats forever. The wall / ladder
 * extend past the SVG box (overflow: visible) so they run behind the
 * login card all the way to the bottom of the screen.
 *
 * Motion is CSS (body travel + bob, see index.css `.login-*`) plus SMIL
 * for the limbs. Both are switched off for prefers-reduced-motion.
 */

const STEP = 1.4; // seconds per rung (matches 44 units of travel)
const RUNG_GAP = 44;
const RUNGS = Array.from({ length: 44 }, (_, i) => 10 + (i - 14) * RUNG_GAP);

// Each limb: two poses [pose1, pose2]; it eases pose1 -> pose2 -> pose1.
const LEGS = {
  // far leg (darker) and near leg, opposite phase
  far: {
    path: ["M 2 30 L -28 44 L -38 68", "M 2 30 L -18 72 L -38 108"],
    boot: [
      [-41, 70],
      [-41, 110],
    ],
  },
  near: {
    path: ["M 0 30 L -18 72 L -38 108", "M 0 30 L -28 44 L -38 68"],
    boot: [
      [-41, 110],
      [-41, 70],
    ],
  },
};
const ARMS = {
  far: {
    path: ["M 2 -36 L -18 -58 L -38 -90", "M 2 -36 L -16 -34 L -38 -46"],
    hand: [
      [-38, -90],
      [-38, -46],
    ],
  },
  near: {
    path: ["M -2 -38 L -20 -32 L -38 -46", "M -2 -38 L -22 -58 L -38 -90"],
    hand: [
      [-38, -46],
      [-38, -90],
    ],
  },
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

const loop = (a, b) => `${a};${b};${a}`;
const smil = {
  dur: `${STEP}s`,
  repeatCount: "indefinite",
  calcMode: "spline",
  keyTimes: "0;0.5;1",
  keySplines: "0.45 0 0.55 1;0.45 0 0.55 1",
};

function Limb({ pose, stroke, width, reduced }) {
  return (
    <path
      d={pose.path[0]}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {!reduced && (
        <animate
          attributeName="d"
          values={loop(pose.path[0], pose.path[1])}
          {...smil}
        />
      )}
    </path>
  );
}

function Tip({ pts, r, fill, ry, reduced }) {
  const rr = ry ?? r;
  return (
    <ellipse cx={pts[0][0]} cy={pts[0][1]} rx={r} ry={rr} fill={fill}>
      {!reduced && (
        <>
          <animate
            attributeName="cx"
            values={loop(pts[0][0], pts[1][0])}
            {...smil}
          />
          <animate
            attributeName="cy"
            values={loop(pts[0][1], pts[1][1])}
            {...smil}
          />
        </>
      )}
    </ellipse>
  );
}

function Climber({ reduced }) {
  const TORSO =
    "M -13 -44 Q 8 -49 15 -38 L 17 22 Q 8 34 -10 32 Q -17 0 -13 -44 Z";
  return (
    <g transform="translate(96 250)">
      <g className="login-bob">
        {/* far leg + far arm (behind torso) */}
        <Limb pose={LEGS.far} stroke="#12234a" width={14} reduced={reduced} />
        <Tip
          pts={LEGS.far.boot}
          r={10}
          ry={5.5}
          fill="#10151f"
          reduced={reduced}
        />
        <Limb pose={ARMS.far} stroke="#d85a08" width={11} reduced={reduced} />
        <Tip pts={ARMS.far.hand} r={6} fill="#141922" reduced={reduced} />

        {/* torso */}
        <defs>
          <clipPath id="login-torso">
            <path d={TORSO} />
          </clipPath>
        </defs>
        <path d={TORSO} fill="#f36b0e" />
        <g clipPath="url(#login-torso)">
          <rect x="-20" y="-10" width="44" height="8" fill="#dfe3ea" />
          <rect
            x="-20"
            y="-24"
            width="44"
            height="3"
            fill="#dfe3ea"
            opacity=".85"
          />
          <path d="M -12 -44 L 14 24" stroke="#151c2b" strokeWidth="5" />
          <path d="M 8 -48 L 8 30" stroke="#151c2b" strokeWidth="4" />
        </g>
        {/* belt + thigh loop */}
        <rect x="-15" y="19" width="34" height="9" rx="3" fill="#151c2b" />
        <rect x="-4" y="21" width="7" height="5" rx="1.5" fill="#f2b01c" />

        {/* near leg + near arm (in front of torso) */}
        <Limb pose={LEGS.near} stroke="#1c2f5c" width={15} reduced={reduced} />
        <Tip
          pts={LEGS.near.boot}
          r={10}
          ry={5.5}
          fill="#10151f"
          reduced={reduced}
        />
        <Limb pose={ARMS.near} stroke="#f26b0f" width={12} reduced={reduced} />
        <Tip pts={ARMS.near.hand} r={6.5} fill="#141922" reduced={reduced} />

        {/* head + hard hat */}
        <rect x="-6" y="-56" width="10" height="12" rx="4" fill="#b97b52" />
        <circle cx="-8" cy="-62" r="11" fill="#c68a62" />
        <path d="M -23 -65 Q -22 -88 -2 -86 Q 14 -84 14 -65 Z" fill="#f7a81b" />
        <path
          d="M -14 -82 Q -4 -88 6 -82"
          fill="none"
          stroke="#ffd36e"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect
          x="-32"
          y="-66"
          width="30"
          height="5.5"
          rx="2.75"
          fill="#e2900c"
        />
      </g>
    </g>
  );
}

function Clouds() {
  return (
    <g filter="url(#login-blur)" fill="#fff">
      <g className="login-cloud login-cloud-a">
        <ellipse cx="290" cy="300" rx="110" ry="26" opacity=".75" />
        <ellipse cx="250" cy="282" rx="60" ry="26" opacity=".8" />
        <ellipse cx="340" cy="286" rx="50" ry="22" opacity=".8" />
      </g>
      <g className="login-cloud login-cloud-b">
        <ellipse cx="470" cy="190" rx="90" ry="20" opacity=".7" />
        <ellipse cx="450" cy="176" rx="46" ry="20" opacity=".75" />
      </g>
      <g className="login-cloud login-cloud-c">
        <ellipse cx="180" cy="70" rx="70" ry="14" opacity=".45" />
      </g>
    </g>
  );
}

export default function LoginMobileScene() {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="relative z-0 flex-1 min-h-[210px] lg:hidden"
    >
      <svg
        className={`absolute inset-0 h-full w-full overflow-visible ${
          reduced ? "login-still" : ""
        }`}
        viewBox="0 0 400 360"
        preserveAspectRatio="xMinYMax meet"
      >
        <defs>
          <linearGradient id="login-wall" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0b1f45" />
            <stop offset="0.8" stopColor="#0b1f45" />
            <stop offset="1" stopColor="#0b1f45" />
          </linearGradient>
          <linearGradient
            id="login-fade"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="330"
            x2="0"
            y2="820"
          >
            <stop offset="0" stopColor="#eaf4fd" stopOpacity="0" />
            <stop offset="1" stopColor="#eaf4fd" stopOpacity="0.96" />
          </linearGradient>
          <filter id="login-blur" x="-30%" y="-100%" width="160%" height="300%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        <Clouds />

        {/* wall */}
        <rect
          x="-3000"
          y="-3000"
          width="3092"
          height="7000"
          fill="url(#login-wall)"
        />
        {[40, 170, 300, 430, 560, 690].map((y) => (
          <line
            key={y}
            x1="-3000"
            x2="92"
            y1={y}
            y2={y}
            stroke="#000000"
            strokeOpacity=".3"
            strokeWidth="2"
          />
        ))}
        <rect
          x="86"
          y="-3000"
          width="6"
          height="7000"
          fill="#ffffff"
          opacity=".12"
        />

        {/* ladder */}
        <line
          x1="46"
          x2="46"
          y1="-3000"
          y2="4000"
          stroke="#eef1f5"
          strokeWidth="5"
        />
        <line
          x1="70"
          x2="70"
          y1="-3000"
          y2="4000"
          stroke="#eef1f5"
          strokeWidth="5"
        />
        <line
          x1="46"
          x2="46"
          y1="-3000"
          y2="4000"
          stroke="#aab5c6"
          strokeWidth="5"
          strokeDasharray="2 5"
        />
        <line
          x1="70"
          x2="70"
          y1="-3000"
          y2="4000"
          stroke="#aab5c6"
          strokeWidth="5"
          strokeDasharray="2 5"
        />
        {RUNGS.map((y) => (
          <rect
            key={y}
            x="41"
            y={y}
            width="34"
            height="6"
            rx="3"
            fill="#f4f6f9"
            stroke="#b4bfcf"
            strokeWidth="1"
          />
        ))}

        {/* wall fades into the sky toward the bottom of the screen */}
        <rect
          x="-3000"
          y="330"
          width="3200"
          height="3000"
          fill="url(#login-fade)"
        />

        <g className="login-travel">
          <Climber reduced={reduced} />
        </g>
      </svg>

      {/* brand + tagline */}
      <div className="absolute right-6 top-0 w-[44%] max-w-[190px] pt-[max(2.25rem,calc(env(safe-area-inset-top)+1.25rem))]">
        <img src={logo} alt="" className="w-[78%] max-w-[150px] h-auto" />
        <p className="mt-4 text-[15px] font-medium leading-snug tracking-wide text-[#0b1f45]">
          Safety Builds a Stronger Tomorrow
        </p>
        <div className="mt-2.5 h-[3px] w-12 rounded-full bg-brand-orange" />
      </div>
    </div>
  );
}
