"use client";

import { Id } from "@/convex/_generated/dataModel";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "away" | "offline";
  showStatus?: boolean;
}

const COLORS = [
  "#5865f2", "#23a55a", "#f0b132", "#00a8fc",
  "#ed4245", "#eb459e", "#faa61a", "#3ba55c",
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(/[\s_-]/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  src,
  size = "md",
  status,
  showStatus = false,
}: AvatarProps) {
  return (
    <div
      className={`avatar avatar-${size} relative`}
      style={{ background: src ? undefined : getColor(name) }}
    >
      {src ? (
        <img src={src} alt={name} />
      ) : (
        <span style={{ fontSize: size === "xl" ? 28 : size === "lg" ? 18 : size === "md" ? 14 : 10 }}>
          {getInitials(name) || "?"}
        </span>
      )}
      {showStatus && status && (
        <span className={`status-dot ${status}`} />
      )}
    </div>
  );
}
