import type { CSSProperties } from "react";
import type { Team } from "../sim/types";

export function TeamHelmet({ team, size = "md" }: { team: Team; size?: "sm" | "md" | "lg" }) {
  const variant = (team.helmetIndex ?? fallbackHelmetIndex(team.id)) % 14;
  return (
    <span
      className={`team-helmet helmet-${variant} helmet-${size}`}
      style={
        {
          "--helmet-primary": team.primary,
          "--helmet-secondary": team.secondary,
        } as CSSProperties
      }
      aria-label={`${team.name} helmet`}
      role="img"
    >
      <i />
      <b />
    </span>
  );
}

function fallbackHelmetIndex(teamId: string): number {
  const numeric = Number(teamId.replace(/\D/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}
