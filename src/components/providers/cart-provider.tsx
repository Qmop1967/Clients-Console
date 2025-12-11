"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface CartItem {
  item_id: string;
  name: string;
  sku: string;
  rate: number;
  quantity: number;
  image_url: string | null;
  available_stock: number;
  unit: string;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  currencyCode: string;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  isInCart: (itemId: string) => boolean;
  getItemQuantity: (itemId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "tsh-cart";

interface CartProviderProps {
  children: React.ReactNode;
  currencyCode?: string;
}

export function CartProvider({ children, currencyCode = "IQD" }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (error) {
      console.error("Error loading cart from localStorage:", error);
    }
    setIsHydrated(true);
  }, []);

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        console.error("Error saving cart to localStorage:", error);
      }
    }
  }, [items, isHydrated]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex((i) => i.item_id === item.item_id);

      if (existingIndex >= 0) {
        // Update existing item quantity
        const updated = [...prevItems];
        const newQuantity = updated[existingIndex].quantity + quantity;
        // Don't exceed available stock
        updated[existingIndex].quantity = Math.min(newQuantity, item.available_stock);
        return updated;
      }

      // Add new item
      return [...prevItems, { ...item, quantity: Math.min(quantity, item.available_stock) }];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.item_id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.item_id === itemId
          ? { ...item, quantity: Math.min(quantity, item.available_stock) }
          : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback((itemId: string) => {
    return items.some((item) => item.item_id === itemId);
  }, [items]);

  const getItemQuantity = useCallback((itemId: string) => {
    const item = items.find((i) => i.item_id === itemId);
    return item?.quantity || 0;
  }, [items]);

  const itemCount = items.length; // Number of unique items, not total quantity
  const subtotal = items.reduce((total, item) => total + item.rate * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        currencyCode,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        isInCart,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
