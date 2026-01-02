export default function Skeleton({
  className = "",
  variant = "text",
}: {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
}) {
  const baseClasses = "animate-pulse bg-slate-200";
  const variantClasses = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded",
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    />
  );
}
