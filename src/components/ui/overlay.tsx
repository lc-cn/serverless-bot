'use client';

import { cn } from '@/lib/shared/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

/** 兼容旧 API 的模态层，底层使用 shadcn Dialog（Radix）。 */
export function Overlay({ isOpen, onClose, children, title, className }: OverlayProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'max-h-[90vh] min-w-0 gap-0 overflow-y-auto overflow-x-hidden p-0 sm:rounded-lg',
          title ? 'pt-0' : undefined,
          className,
        )}
      >
        {title ? (
          <>
            <DialogHeader className="space-y-0 border-b border-border p-4 pr-12 text-left">
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="min-w-0 p-4">{children}</div>
          </>
        ) : (
          <>
            <DialogTitle className="sr-only">Dialog</DialogTitle>
            <div className="min-w-0 p-4 pt-6">{children}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
