import type { Team } from "../sim/types";

export function TeamHelmet({ team, size = "md" }: { team: Team; size?: "sm" | "md" | "lg" }) {
  const variant = (team.helmetIndex ?? fallbackHelmetIndex(team.id)) % 14;
  const src = `/assets/team-helmets/helmet-${variant.toString().padStart(2, "0")}.png`;
  return (
    <span
      className={`team-helmet helmet-${size}`}
      aria-label={`${team.name} helmet`}
      role="img"
    >
      <img src={src} alt="" draggable={false} />
    </span>
  );
}

function fallbackHelmetIndex(teamId: string): number {
  const numeric = Number(teamId.replace(/\D/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}
