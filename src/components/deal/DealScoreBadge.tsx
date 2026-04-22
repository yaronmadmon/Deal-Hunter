interface Props {
  score: number | null;
  size?: "sm" | "md";
}

export const DealScoreBadge = ({ score, size = "md" }: Props) => {
  if (score === null || score === undefined) return null;
  const color =
    score >= 70
      ? "bg-green-500/15 text-green-400 border-green-500/30"
      : score >= 40
      ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
      : "bg-red-500/15 text-red-400 border-red-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"} ${color}`}>
      {score}
    </span>
  );
};
