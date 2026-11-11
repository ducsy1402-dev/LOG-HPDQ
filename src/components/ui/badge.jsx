import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-semibold", {
  variants: {
    tone: {
      default: "border-transparent bg-secondary text-secondary-foreground",
      primary: "border-transparent bg-primary/15 text-primary",
      ok: "border-transparent bg-ok/15 text-ok",
      warn: "border-transparent bg-warn/15 text-warn",
      bad: "border-transparent bg-bad/15 text-bad",
      info: "border-transparent bg-info/15 text-info",
      outline: "text-muted-foreground",
    },
  },
  defaultVariants: { tone: "default" },
});

export const Badge = ({ className, tone, ...p }) => <span className={cn(badgeVariants({ tone }), className)} {...p} />;
