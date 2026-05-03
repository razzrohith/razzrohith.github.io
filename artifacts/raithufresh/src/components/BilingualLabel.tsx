import React from "react";
import { cn } from "@/lib/utils";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";

export type BilingualVariant = 
  | "default" 
  | "onFilled" 
  | "onDark" 
  | "onLight" 
  | "muted" 
  | "button";

interface BilingualLabelProps {
  en: string;
  te: string;
  className?: string;
  enClassName?: string;
  teClassName?: string;
  orientation?: "inline" | "stacked";
  separator?: string;
  variant?: BilingualVariant;
}

export default function BilingualLabel({
  en,
  te,
  className,
  enClassName,
  teClassName,
  orientation = "inline",
  separator = "/",
  variant = "default",
}: BilingualLabelProps) {
  const { isTeluguEnabled } = useAppPreferences();

  if (!isTeluguEnabled) {
    return <span className={enClassName}>{en}</span>;
  }

  // Determine helper text (Telugu) styling based on variant
  const getTeStyles = () => {
    switch (variant) {
      case "onFilled":
      case "button":
        return "text-white/90 font-normal"; // High contrast for colored buttons
      case "onDark":
        return "text-white/70 font-normal";
      case "onLight":
        return "text-slate-500 font-normal";
      case "muted":
        return "text-muted-foreground/60 font-normal italic";
      case "default":
      default:
        // Default handles both light/dark via CSS variables if text-muted-foreground is well-defined
        // but we ensure it's readable on light surfaces by default.
        return "text-muted-foreground font-normal";
    }
  };

  if (orientation === "stacked") {
    return (
      <div className={cn("flex flex-col text-left", className)}>
        <span className={cn("font-semibold tracking-tight", enClassName)}>{en}</span>
        <span className={cn("text-[0.75em] leading-tight mt-0.5", getTeStyles(), teClassName)}>
          {te}
        </span>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-baseline gap-1.5 flex-wrap", className)}>
      <span className={cn("font-semibold", enClassName)}>{en}</span>
      <span className={cn("text-[0.8em] opacity-85", getTeStyles(), teClassName)}>
        {separator} {te}
      </span>
    </span>
  );
}
