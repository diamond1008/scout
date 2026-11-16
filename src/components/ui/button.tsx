import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-[#0071e3] text-white shadow-xs shadow-blue-500/20 hover:bg-[#0077ed] hover:shadow-md hover:shadow-blue-500/25",
        destructive: "bg-rose-50 text-rose-700 border border-rose-200/90 hover:bg-rose-100 hover:text-rose-800",
        outline: "border border-slate-200/90 bg-white/80 backdrop-blur-md text-slate-800 shadow-2xs hover:bg-white hover:border-slate-300 hover:shadow-xs",
        secondary: "bg-slate-100/90 text-slate-800 hover:bg-slate-200/80 backdrop-blur-md",
        ghost: "hover:bg-slate-100/80 text-slate-700 hover:text-slate-900",
        link: "text-[#0071e3] underline-offset-4 hover:underline",
        success: "bg-emerald-600 text-white shadow-xs shadow-emerald-500/20 hover:bg-emerald-500 hover:shadow-md hover:shadow-emerald-500/25",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-xl px-6",
        icon: "h-9 w-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
