import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Field } from "@/components/greenroom";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Shared presentational atoms for the help-guide mockups. These are purely
 * decorative — they always render inside an `inert` <Snapshot>, so nothing
 * here is interactive.
 */

/** Icon + caption + value, as seen in the offer/project fact grids. */
export function Fact({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      {Icon && (
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <div className="text-[10px] leading-tight text-muted-foreground">
          {label}
        </div>
        <div className="truncate text-xs font-medium">{value}</div>
      </div>
    </div>
  );
}

/** A labeled, filled-in form field (read-only Input) for form previews. */
export function FakeField({
  label,
  value,
  required,
  placeholder,
  className,
}: {
  label: string;
  value?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field label={label} required={required} className={className}>
      <Input
        readOnly
        tabIndex={-1}
        value={value ?? ""}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </Field>
  );
}
