import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}) {
  const variantClasses = {
    default: "bg-[#0071e3] text-white shadow-xs shadow-blue-500/20",
    secondary: "bg-slate-100 text-slate-700 border border-slate-200/80 backdrop-blur-md",
    destructive: "bg-rose-50 text-rose-700 border border-rose-200/90 backdrop-blur-md",
    outline: "border border-slate-200/90 bg-white/80 text-slate-700 backdrop-blur-md shadow-2xs",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200/90 backdrop-blur-md",
    warning: "bg-amber-50 text-amber-700 border border-amber-200/90 backdrop-blur-md",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors whitespace-nowrap shrink-0",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
