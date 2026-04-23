const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  tax_lien:    { label: "Tax Lien",       color: "bg-amber-500/8 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  foreclosure: { label: "Foreclosure",    color: "bg-red-500/8 text-red-600 dark:text-red-400 border-red-500/20" },
  divorce:     { label: "Divorce/Probate", color: "bg-purple-500/8 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  delinquency: { label: "Delinquency",    color: "bg-orange-500/8 text-orange-600 dark:text-orange-400 border-orange-500/20" },
};

export const DistressTypeBadge = ({ type }: { type: string }) => {
  const config = TYPE_CONFIG[type] ?? { label: type, color: "bg-secondary text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};
