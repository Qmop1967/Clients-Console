"use client";

import * as React from "react";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { CatalogModeModal } from "@/components/ui/catalog-mode-modal";
import { CatalogSplashModal } from "@/components/ui/catalog-splash-modal";

const SPLASH_STORAGE_KEY = "tsh-catalog-splash-seen";

interface CatalogModeContextType {
  /** Whether catalog mode is currently enabled */
  isCatalogMode: boolean;
  /** Show the catalog mode modal to inform the user */
  showCatalogModal: () => void;
}

const CatalogModeContext = createContext<CatalogModeContextType | undefined>(
  undefined
);

interface CatalogModeProviderProps {
  children: ReactNode;
}

/**
 * Provider for catalog mode state.
 *
 * When NEXT_PUBLIC_CATALOG_MODE=true:
 * - isCatalogMode will be true
 * - Components should hide prices/stock and disable cart actions
 * - showCatalogModal() displays informational modal
 * - Splash modal shows on first visit to explain the situation
 *
 * Wrap the app with this provider to enable catalog mode detection
 * in any component via useCatalogMode() hook.
 */
export function CatalogModeProvider({ children }: CatalogModeProviderProps) {
  // Read from env var - available at build time and runtime
  const isCatalogMode = process.env.NEXT_PUBLIC_CATALOG_MODE === "true";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSplashOpen, setIsSplashOpen] = useState(false);

  // Show splash on first visit (only in catalog mode)
  useEffect(() => {
    if (!isCatalogMode) return;

    // Check if user has already seen the splash
    const hasSeen = localStorage.getItem(SPLASH_STORAGE_KEY);
    if (!hasSeen) {
      // Small delay for better UX - let the page render first
      const timer = setTimeout(() => {
        setIsSplashOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isCatalogMode]);

  const showCatalogModal = useCallback(() => {
    if (isCatalogMode) {
      setIsModalOpen(true);
    }
  }, [isCatalogMode]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const closeSplash = useCallback(() => {
    setIsSplashOpen(false);
    // Mark as seen so it doesn't show again
    localStorage.setItem(SPLASH_STORAGE_KEY, "true");
  }, []);

  return (
    <CatalogModeContext.Provider value={{ isCatalogMode, showCatalogModal }}>
      {children}
      {/* Splash modal - shows once on first visit */}
      <CatalogSplashModal open={isSplashOpen} onClose={closeSplash} />
      {/* Action modal - shows when user tries to add to cart/checkout */}
      <CatalogModeModal open={isModalOpen} onClose={closeModal} />
    </CatalogModeContext.Provider>
  );
}

/**
 * Hook to access catalog mode state and actions.
 *
 * @example
 * const { isCatalogMode, showCatalogModal } = useCatalogMode();
 *
 * // Hide prices when in catalog mode
 * {!isCatalogMode && <Price value={product.rate} />}
 *
 * // Show modal instead of adding to cart
 * const handleAddToCart = isCatalogMode ? showCatalogModal : addItem;
 */
export function useCatalogMode(): CatalogModeContextType {
  const context = useContext(CatalogModeContext);
  if (context === undefined) {
    throw new Error("useCatalogMode must be used within a CatalogModeProvider");
  }
  return context;
}
