import * as M from "@radix-ui/react-dropdown-menu";
import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const box = "z-50 min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0";

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuContent = ({ className, sideOffset = 4, ...p }) => <M.Portal><M.Content sideOffset={sideOffset} className={cn(box, className)} {...p} /></M.Portal>;
export const DropdownMenuItem = ({ className, ...p }) => <M.Item className={cn("relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent [&_svg]:size-4", className)} {...p} />;
export const DropdownMenuSeparator = ({ className, ...p }) => <M.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...p} />;
export const DropdownMenuLabel = ({ className, ...p }) => <M.Label className={cn("px-2 py-1 text-xs text-muted-foreground", className)} {...p} />;

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverContent = ({ className, align = "end", sideOffset = 6, ...p }) => <P.Portal><P.Content align={align} sideOffset={sideOffset} className={cn(box, "w-80 p-0", className)} {...p} /></P.Portal>;
