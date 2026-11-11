import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export const TabsList = ({ className, ...p }) => <T.List className={cn("inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground", className)} {...p} />;
export const TabsTrigger = ({ className, ...p }) => (
  <T.Trigger className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-[0.8125rem] font-medium transition-all data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm [&_svg]:size-4", className)} {...p} />
);
export const TabsContent = ({ className, ...p }) => <T.Content className={cn("mt-3 focus-visible:outline-none", className)} {...p} />;
