"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, History, Phone, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface CatalogSplashModalProps {
  open: boolean;
  onClose: () => void;
}

export function CatalogSplashModal({ open, onClose }: CatalogSplashModalProps) {
  const t = useTranslations("catalogSplash");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-lg p-0 overflow-hidden border-0 gap-0"
        dir="rtl"
        hideCloseButton
      >
        {/* Warning Header with Animation */}
        <div className="relative bg-gradient-to-br from-amber-500 via-amber-400 to-orange-500 px-6 py-8 text-white">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full animate-pulse" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/10 rounded-full animate-pulse delay-300" />
            <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-white/5 rounded-full animate-bounce-slow" />
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 left-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Warning Icon with Animation */}
          <div className="relative flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/40">
                <AlertTriangle className="h-10 w-10 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="relative text-center text-2xl font-bold font-display">
            {t("title")}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-5 bg-background">
          {/* Main Message */}
          <p className="text-muted-foreground leading-relaxed text-center">
            {t("reason")}
          </p>

          {/* What You Can Do Section */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t("youCanStill")}
            </h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Package className="h-4 w-4 text-primary" />
                </div>
                <span>{t("browseProducts")}</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <History className="h-4 w-4 text-primary" />
                </div>
                <span>{t("viewHistory")}</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <span>{t("contactSales")}</span>
              </li>
            </ul>
          </div>

          {/* Apology Note */}
          <p className="text-sm text-muted-foreground text-center italic">
            {t("apology")}
          </p>

          {/* Action Button */}
          <Button
            variant="gold"
            className="w-full h-12 text-base font-medium"
            onClick={onClose}
          >
            {t("understood")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
