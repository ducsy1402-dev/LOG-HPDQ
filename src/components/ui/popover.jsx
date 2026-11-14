import { forwardRef } from "react";
import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

// Hộp nổi nhỏ bấm để mở (shadcn/ui): dùng ngoài hộp thoại; trong hộp thoại có transform thì dùng useNoi (ui/noi.js)
export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverContent = forwardRef(({ className, align = "start", sideOffset = 6, ...p }, ref) => (
  <P.Portal>
    <P.Content ref={ref} align={align} sideOffset={sideOffset} collisionPadding={8}
      className={cn("z-50 w-80 rounded-lg border bg-popover p-0 text-sm text-popover-foreground shadow-xl outline-none", className)} {...p} />
  </P.Portal>
));
PopoverContent.displayName = "PopoverContent";
