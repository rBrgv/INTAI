import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

export default function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  const variantClasses = {
    default: "bg-[var(--card)] text-[var(--text-secondary)] border border-[var(--border)]",
    success: "bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success)]",
    warning: "bg-[var(--warning-bg)] text-[var(--warning)] border border-[var(--warning)]",
    error: "bg-[var(--danger-bg)] text-[var(--danger)] border border-[var(--danger)]",
    info: "bg-[var(--info-bg)] text-[var(--info)] border border-[var(--info)]",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
