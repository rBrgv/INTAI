import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type IconProps = {
  icon: LucideIcon;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  color?: "default" | "primary" | "success" | "warning" | "danger" | "muted";
};

const sizeMap = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-8 h-8",
};

const colorMap = {
  default: "text-[var(--text)]",
  primary: "text-[var(--primary)]",
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger)]",
  muted: "text-[var(--muted)]",
};

export default function Icon({
  icon: IconComponent,
  size = "md",
  className = "",
  color = "default",
}: IconProps) {
  return (
    <IconComponent
      className={cn(sizeMap[size], colorMap[color], className)}
      aria-hidden="true"
    />
  );
}

