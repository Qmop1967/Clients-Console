"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface CatalogModeModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal displayed when catalog mode is active and user attempts
 * to add items to cart, access cart, or checkout.
 *
 * Displays a professional Arabic message directing customers
 * to contact their regional sales representative.
 */
export function CatalogModeModal({ open, onClose }: CatalogModeModalProps) {
  const t = useTranslations("catalogMode");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md text-center"
        dir="rtl"
      >
        <DialogHeader className="space-y-4">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>

          <DialogTitle className="text-xl font-bold font-display">
            {t("title")}
          </DialogTitle>

          <DialogDescription className="text-base leading-relaxed whitespace-pre-line text-muted-foreground">
            {t("message")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-6 sm:justify-center">
          <Button
            variant="gold"
            className="w-full sm:w-auto min-w-[200px]"
            onClick={onClose}
          >
            {t("continueBrowsing")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
