import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const base = "flex w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const Input = forwardRef(({ className, ...p }, ref) => <input ref={ref} className={cn(base, "h-9", className)} {...p} />);
Input.displayName = "Input";

export const Textarea = forwardRef(({ className, ...p }, ref) => <textarea ref={ref} className={cn(base, "min-h-[80px] py-2", className)} {...p} />);
Textarea.displayName = "Textarea";

// Hộp chọn gốc của trình duyệt (gọn, dùng tốt trên điện thoại). options: [[value, label]] hoặc ["value"]
export const NativeSelect = forwardRef(({ className, options = [], placeholder, ...p }, ref) => (
  <select ref={ref} className={cn(base, "h-9 pr-7", className)} {...p}>
    {placeholder != null && <option value="">{placeholder}</option>}
    {options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}
  </select>
));
NativeSelect.displayName = "NativeSelect";

export const Label = ({ className, ...p }) => <label className={cn("text-xs font-medium text-muted-foreground", className)} {...p} />;

export function Field({ label, hint, children, className }) {
  return (
    <div className={cn("grid content-start gap-1", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <span className="text-[0.6875rem] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export const Checkbox = ({ className, ...p }) => <input type="checkbox" className={cn("h-4 w-4 cursor-pointer accent-[hsl(var(--primary))]", className)} {...p} />;
