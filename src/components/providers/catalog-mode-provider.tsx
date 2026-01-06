"use client";

import * as React from "react";
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CatalogModeModal } from "@/components/ui/catalog-mode-modal";

interface CatalogModeContextType {
  /** Whether catalog mode is currently enabled */
  isCatalogMode: boolean;
  /** Show the catalog mode modal to inform the user */
  showCatalogModal: () => void;
}

const CatalogModeContext = createContext<CatalogModeContextType | undefined>(undefined);

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
 *
 * Wrap the app with this provider to enable catalog mode detection
 * in any component via useCatalogMode() hook.
 */
export function CatalogModeProvider({ children }: CatalogModeProviderProps) {
  // Read from env var - available at build time and runtime
  const isCatalogMode = process.env.NEXT_PUBLIC_CATALOG_MODE === "true";
  const [isModalOpen, setIsModalOpen] = useState(false);

  const showCatalogModal = useCallback(() => {
    if (isCatalogMode) {
      setIsModalOpen(true);
    }
  }, [isCatalogMode]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <CatalogModeContext.Provider value={{ isCatalogMode, showCatalogModal }}>
      {children}
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
