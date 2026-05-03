import React from "react";
import { cn } from "@/lib/utils";

interface BilingualLabelProps {
  en: string;
  te: string;
  className?: string;
  enClassName?: string;
  teClassName?: string;
  orientation?: "inline" | "stacked";
  separator?: string;
}

export default function BilingualLabel({
  en,
  te,
  className,
  enClassName,
  teClassName,
  orientation = "inline",
  separator = "/",
}: BilingualLabelProps) {
  if (orientation === "stacked") {
    return (
      <div className={cn("flex flex-col", className)}>
        <span className={cn("font-medium", enClassName)}>{en}</span>
        <span className={cn("text-[0.8em] leading-tight text-muted-foreground font-normal", teClassName)}>
          {te}
        </span>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 flex-wrap", className)}>
      <span className={enClassName}>{en}</span>
      <span className={cn("text-[0.85em] text-muted-foreground font-normal", teClassName)}>
        {separator} {te}
      </span>
    </span>
  );
}
