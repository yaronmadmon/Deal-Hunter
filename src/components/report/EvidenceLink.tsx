import { ExternalLink } from "lucide-react";

interface Props {
  href?: string | null;
  label: string;
}

export const EvidenceLink = ({ href, label }: Props) => {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-0.5 transition-colors"
    >
      {label}
      <ExternalLink className="w-2.5 h-2.5" />
    </a>
  );
};
