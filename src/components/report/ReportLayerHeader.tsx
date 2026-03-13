import { cn } from "@/lib/utils";

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const ReportLayerHeader = ({ id, title, subtitle, icon, className }: Props) => (
  <div id={id} className={cn("pt-10 pb-4 scroll-mt-20", className)}>
    <div className="flex items-center gap-3">
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
      <div>
        <h2 className="font-heading text-lg font-bold text-foreground uppercase tracking-wider text-primary/80">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
    <div className="mt-3 h-px bg-gradient-to-r from-primary/30 via-border/50 to-transparent" />
  </div>
);
