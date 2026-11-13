import * as React from "react";
import { cn } from "@/lib/utils";

interface ContextMenuContextType {
  open: boolean;
  position: { x: number; y: number };
  setOpen: (v: boolean) => void;
  setPosition: (pos: { x: number; y: number }) => void;
}

const ContextMenuContext = React.createContext<ContextMenuContextType | null>(null);

export function ContextMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleClose = () => setOpen(false);
    if (open) {
      window.addEventListener("click", handleClose);
      window.addEventListener("contextmenu", handleClose);
    }
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("contextmenu", handleClose);
    };
  }, [open]);

  return (
    <ContextMenuContext.Provider value={{ open, position, setOpen, setPosition }}>
      <div className="relative">{children}</div>
    </ContextMenuContext.Provider>
  );
}

export function ContextMenuTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const ctx = React.useContext(ContextMenuContext);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!ctx) return;
    e.preventDefault();
    ctx.setPosition({ x: e.clientX, y: e.clientY });
    ctx.setOpen(true);
  };

  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onContextMenu: handleContextMenu,
    });
  }

  return <div onContextMenu={handleContextMenu}>{children}</div>;
}

export function ContextMenuContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(ContextMenuContext);
  if (!ctx || !ctx.open) return null;

  return (
    <div
      style={{ top: ctx.position.y, left: ctx.position.x }}
      className={cn(
        "fixed z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ContextMenuItem({
  className,
  onClick,
  children,
}: {
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(ContextMenuContext);
  return (
    <div
      onClick={(e) => {
        onClick?.(e);
        ctx?.setOpen(false);
      }}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ContextMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-border", className)} />;
}
