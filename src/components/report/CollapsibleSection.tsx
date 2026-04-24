import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  icon?: React.ReactNode;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export const CollapsibleSection = ({
  title,
  icon,
  summary,
  defaultOpen = false,
  children,
  className,
  id,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className={cn("mb-6", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border/50 bg-card/50 hover:bg-card transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 text-left">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="text-sm font-medium text-foreground">{title}</span>
          {summary && !open && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              — {summary}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
};
