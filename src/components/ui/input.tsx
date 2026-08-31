import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-md border border-ink-200 bg-white px-2.5 text-sm text-ink-900 placeholder:text-ink-400 transition-shadow disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500 aria-[invalid=true]:border-[var(--color-signal-negative)]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, "h-9", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "py-2 min-h-20 leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      base,
      "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%2378786f%22><path d=%22M5.2 7.5 10 12l4.8-4.5z%22/></svg>')] bg-[length:16px] bg-[right_0.5rem_center] bg-no-repeat pr-8",
      className,
    )}
    {...props}
  />
));
Select.displayName = "Select";

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("block text-[13px] font-medium text-ink-700 mb-1.5", className)} {...props}>
      {children}
      {required && <span className="text-[var(--color-signal-negative)] ml-0.5">*</span>}
    </label>
  );
}

export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[12px] text-ink-500">{children}</p>;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-[12px] text-[var(--color-signal-negative)]">{children}</p>;
}

export function Field({
  label,
  required,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {hint && !error && <FieldHint>{hint}</FieldHint>}
      <FieldError>{error}</FieldError>
    </div>
  );
}
