import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

interface Props {
  level: "High" | "Medium" | "Low";
  showIcon?: boolean;
}

export const ConfidenceLabel = ({ level, showIcon = true }: Props) => {
  const config = {
    High: { variant: "go" as const, icon: ShieldCheck, label: "High confidence" },
    Medium: { variant: "pivot" as const, icon: ShieldAlert, label: "Medium confidence" },
    Low: { variant: "nogo" as const, icon: ShieldQuestion, label: "Low confidence" },
  };

  const { variant, icon: Icon, label } = config[level];

  return (
    <Badge variant={variant} className="text-[9px] px-1.5 py-0 gap-0.5">
      {showIcon && <Icon className="w-2.5 h-2.5" />}
      {label}
    </Badge>
  );
};
