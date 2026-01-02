import { ReactNode } from "react";

export default function Card({
  children,
  className = "",
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "outlined" | "elevated";
}) {
  const baseClasses = "rounded-xl p-4 sm:p-6";
  const variantClasses = {
    default: "app-card",
    outlined: "bg-[var(--card)] border-2 border-[var(--border)] shadow-sm",
    elevated: "bg-[var(--card)] border border-[var(--border)] shadow-sm",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}
