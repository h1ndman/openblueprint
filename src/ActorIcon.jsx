import React from "react";

// Stock actor icons: a human "user", a "channel" (touchpoint / medium),
// and a "system" sprocket. Stroke-based so they inherit currentColor.
export const ACTOR_ICONS = [
  ["user", "User"],
  ["channel", "Channel"],
  ["system", "System"],
];

export default function ActorIcon({ kind, className }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    xmlns: "http://www.w3.org/2000/svg",
  };

  if (kind === "channel") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="2" />
        <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
        <path d="M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
      </svg>
    );
  }

  if (kind === "system") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 13c.04-.33.06-.66.06-1s-.02-.67-.06-1l2-1.6-2-3.46-2.4 1a7 7 0 0 0-1.7-1L14.9 2.5h-4l-.4 2.94a7 7 0 0 0-1.7 1l-2.4-1-2 3.46 2 1.6c-.04.33-.06.66-.06 1s.02.67.06 1l-2 1.6 2 3.46 2.4-1c.5.4 1.08.74 1.7 1l.4 2.94h4l.4-2.94a7 7 0 0 0 1.7-1l2.4 1 2-3.46-2-1.6z" />
      </svg>
    );
  }

  // default: user
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-6.6 7-6.6s7 2.7 7 6.6" />
    </svg>
  );
}
