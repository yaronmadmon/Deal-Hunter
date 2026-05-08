const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  tax_lien: { label: "Tax Lien", color: "border-violet-500/30 bg-violet-500/12 text-violet-200" },
  foreclosure: { label: "Foreclosure", color: "border-sky-500/30 bg-sky-500/12 text-sky-200" },
  divorce: { label: "Divorce/Probate", color: "border-indigo-500/25 bg-indigo-500/10 text-indigo-100" },
  delinquency: { label: "Delinquency", color: "border-blue-500/25 bg-blue-500/10 text-blue-100" },
};

export const DistressTypeBadge = ({ type }: { type: string }) => {
  const config = TYPE_CONFIG[type] ?? { label: type, color: "border-border bg-secondary text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] ${config.color}`}>
      {config.label}
    </span>
  );
};
