"use client";

interface SneakerHeroProps {
  size?: "sm" | "md" | "lg";
  floating?: boolean;
  glowing?: boolean;
  grayscale?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "w-48 h-32",
  md: "w-80 h-56",
  lg: "w-[500px] h-[340px]",
};

export default function SneakerHero({
  size = "lg",
  floating = false,
  glowing = false,
  grayscale = false,
  className = "",
}: SneakerHeroProps) {
  return (
    <div className={`relative flex items-center justify-center ${sizeMap[size]} ${className}`}>
      {/* Glow backdrop */}
      {glowing && !grayscale && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-3/4 h-3/4 rounded-full animate-pulse"
            style={{
              background: "radial-gradient(ellipse at center, rgba(196,18,48,0.15) 0%, rgba(107,92,231,0.08) 40%, transparent 70%)",
            }}
          />
        </div>
      )}

      {/* SVG Sneaker */}
      <svg
        viewBox="0 0 600 340"
        className={`
          w-full h-full relative z-10
          ${floating ? "animate-float" : ""}
          ${grayscale ? "grayscale opacity-40" : ""}
          ${glowing && !grayscale ? "drop-shadow-[0_0_40px_rgba(196,18,48,0.25)]" : ""}
        `}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outsole */}
        <path
          d="M100 270 Q90 270 85 265 L80 260 Q75 255 80 250 L120 245 L480 245 Q500 245 510 250 L520 255 Q525 260 520 268 L510 275 Q505 278 495 278 L120 278 Q110 278 100 270Z"
          fill="#0a0a12"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />

        {/* Midsole with Air Unit */}
        <path
          d="M95 250 L115 230 L490 230 Q510 230 515 240 L518 250 Q520 255 510 255 L105 255 Q95 255 95 250Z"
          fill="#1a1a2e"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />

        {/* Air Max bubble */}
        <ellipse
          cx="420"
          cy="242"
          rx="45"
          ry="12"
          fill="rgba(196,18,48,0.15)"
          stroke="#c41230"
          strokeWidth="1.5"
          strokeDasharray="2 3"
        />
        <ellipse
          cx="200"
          cy="242"
          rx="35"
          ry="10"
          fill="rgba(196,18,48,0.1)"
          stroke="#c41230"
          strokeWidth="1"
          strokeDasharray="2 3"
        />

        {/* Upper - main body */}
        <path
          d="M120 230 L130 160 Q135 140 150 130 L180 115 Q200 105 230 100 L300 92 Q340 90 370 95 L420 105 Q450 115 470 130 L490 150 Q500 170 500 190 L498 220 L490 230Z"
          fill="#1a1a2e"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />

        {/* Toe box */}
        <path
          d="M120 230 L115 225 Q110 215 115 200 L125 175 Q130 165 140 158 L165 145 Q175 140 190 138 L220 135 L230 140 Q235 150 230 165 L210 200 Q200 215 185 225 L165 232 L120 230Z"
          fill="#141422"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="0.5"
        />

        {/* Heel counter */}
        <path
          d="M470 135 Q485 150 495 175 L500 200 L498 225 L490 230 L485 225 Q488 200 485 180 L475 155 Q465 140 460 135 L470 135Z"
          fill="#0f0f1a"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.5"
        />

        {/* Swoosh */}
        <path
          d="M170 200 Q200 180 250 172 Q300 165 360 168 Q400 170 440 178 Q460 183 475 190 L480 185 Q450 170 400 158 Q350 148 290 150 Q230 152 180 170 Q155 180 145 195 L170 200Z"
          fill="#c41230"
        />

        {/* Swoosh highlight */}
        <path
          d="M200 188 Q240 176 290 172 Q340 168 380 172 Q400 174 420 180"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          fill="none"
        />

        {/* Lacing area */}
        <path
          d="M240 105 L250 95 Q260 90 275 88 L310 86 Q330 86 345 90 L360 95 L350 100 L310 94 Q290 93 270 95 L250 100 L240 105Z"
          fill="#0f0f1a"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />

        {/* Lace holes */}
        <circle cx="260" cy="108" r="3" fill="#0a0a12" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
        <circle cx="280" cy="102" r="3" fill="#0a0a12" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
        <circle cx="300" cy="99" r="3" fill="#0a0a12" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
        <circle cx="320" cy="100" r="3" fill="#0a0a12" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
        <circle cx="340" cy="104" r="3" fill="#0a0a12" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />

        {/* Laces */}
        <path
          d="M258 106 Q270 96 282 103 M278 100 Q290 91 302 100 M298 97 Q310 90 322 101 M318 99 Q330 93 342 105"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
          fill="none"
        />

        {/* Tongue */}
        <path
          d="M270 100 Q280 75 300 68 Q320 75 330 100"
          fill="#1a1a2e"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.5"
        />

        {/* Tongue label */}
        <rect x="288" y="76" width="24" height="12" rx="1" fill="#c41230" />
        <line x1="292" y1="80" x2="308" y2="80" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
        <line x1="294" y1="84" x2="306" y2="84" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" />

        {/* Collar/ankle padding */}
        <path
          d="M350 100 Q380 105 410 118 Q440 130 460 140 L465 135 Q440 120 410 108 Q380 98 350 95 L350 100Z"
          fill="#141422"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="0.5"
        />

        {/* Sole texture lines */}
        <line x1="140" y1="265" x2="160" y2="265" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <line x1="180" y1="265" x2="200" y2="265" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <line x1="220" y1="265" x2="240" y2="265" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <line x1="260" y1="265" x2="280" y2="265" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <line x1="300" y1="265" x2="320" y2="265" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <line x1="340" y1="265" x2="360" y2="265" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <line x1="380" y1="265" x2="400" y2="265" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <line x1="420" y1="265" x2="440" y2="265" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        <line x1="460" y1="265" x2="480" y2="265" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      </svg>
    </div>
  );
}
