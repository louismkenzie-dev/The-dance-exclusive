import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Drawer as DrawerPrimitive } from "vaul";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useIsPhone } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky footer (usually the one primary action). */
  footer?: ReactNode;
  /** Extra classes on the scrolling body. */
  bodyClassName?: string;
  /** Max width of the desktop dialog. */
  size?: "md" | "lg";
  /** Theme class to carry into the portal (dialogs portal to <body>). */
  themeClass?: string;
}

/**
 * One booking surface that is a bottom sheet on a phone and a centred
 * dialog on a desktop: header, scrolling body, sticky footer. Pages never
 * pick which — they describe the content and the device decides.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  bodyClassName,
  size = "md",
  themeClass,
}: ResponsiveSheetProps) {
  const isPhone = useIsPhone();

  if (isPhone) {
    return (
      <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
          <DrawerPrimitive.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[24px] border-t border-border bg-card text-card-foreground shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.25)] outline-none",
              themeClass,
            )}
          >
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
            <div className="shrink-0 px-5 pt-3 pb-3">
              <DrawerPrimitive.Title className="text-lg font-semibold tracking-tight text-foreground">
                {title}
              </DrawerPrimitive.Title>
              {description && (
                <DrawerPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </DrawerPrimitive.Description>
              )}
            </div>
            <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5", bodyClassName)}>
              {children}
            </div>
            {footer && (
              <div className="shrink-0 border-t border-border bg-card pb-safe">
                <div className="px-5 py-3">{footer}</div>
              </div>
            )}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            size === "lg" ? "max-w-2xl" : "max-w-lg",
            themeClass,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-xl font-semibold tracking-tight text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="pressable -mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 pb-6", bodyClassName)}>{children}</div>
          {footer && <div className="shrink-0 border-t border-border bg-card px-6 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default ResponsiveSheet;
