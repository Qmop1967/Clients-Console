"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";

export interface CartItem {
  item_id: string;
  name: string;
  sku: string;
  rate: number;
  quantity: number;
  image_url: string | null;
  available_stock: number;
  unit: string;
  note?: string;
  minimum_quantity?: number;
}

export interface MinimumQuantityError {
  hasError: boolean;
  message?: string;
  minimumQuantity?: number;
  attemptedQuantity?: number;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  currencyCode: string;
  orderNote: string;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => MinimumQuantityError;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateItemNote: (itemId: string, note: string) => void;
  updateOrderNote: (note: string) => void;
  clearCart: () => void;
  isInCart: (itemId: string) => boolean;
  getItemQuantity: (itemId: string) => number;
  validateMinimumQuantity: (item: Omit<CartItem, "quantity">, quantity: number) => MinimumQuantityError;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "tsh-cart";
const ORDER_NOTE_STORAGE_KEY = "tsh-cart-order-note";
const SAVE_DEBOUNCE_MS = 300; // Debounce localStorage writes

interface CartProviderProps {
  children: React.ReactNode;
  currencyCode?: string;
}

export function CartProvider({ children, currencyCode = "IQD" }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const orderNoteSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load cart and order note from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }

      const storedNote = localStorage.getItem(ORDER_NOTE_STORAGE_KEY);
      if (storedNote) {
        setOrderNote(storedNote);
      }
    } catch (error) {
      console.error("Error loading cart from localStorage:", error);
    }
    setIsHydrated(true);
  }, []);

  // Debounced save to localStorage - prevents blocking UI on rapid updates
  useEffect(() => {
    if (!isHydrated) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule new save after debounce period
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        console.error("Error saving cart to localStorage:", error);
      }
    }, SAVE_DEBOUNCE_MS);

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [items, isHydrated]);

  // Debounced save order note to localStorage
  useEffect(() => {
    if (!isHydrated) return;

    // Clear any pending save
    if (orderNoteSaveTimeoutRef.current) {
      clearTimeout(orderNoteSaveTimeoutRef.current);
    }

    // Schedule new save after debounce period
    orderNoteSaveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(ORDER_NOTE_STORAGE_KEY, orderNote);
      } catch (error) {
        console.error("Error saving order note to localStorage:", error);
      }
    }, SAVE_DEBOUNCE_MS);

    // Cleanup on unmount
    return () => {
      if (orderNoteSaveTimeoutRef.current) {
        clearTimeout(orderNoteSaveTimeoutRef.current);
      }
    };
  }, [orderNote, isHydrated]);

  // Create a Map for O(1) lookups instead of O(n) array.find()
  const itemsMap = useMemo(() => {
    const map = new Map<string, CartItem>();
    for (const item of items) {
      map.set(item.item_id, item);
    }
    return map;
  }, [items]);

  // Validate minimum quantity for an item
  const validateMinimumQuantity = useCallback((item: Omit<CartItem, "quantity">, quantity: number): MinimumQuantityError => {
    // Check if item has minimum quantity requirement
    if (!item.minimum_quantity || item.minimum_quantity <= 0) {
      return { hasError: false };
    }

    // Get current quantity in cart
    const currentQuantity = itemsMap.get(item.item_id)?.quantity || 0;
    const totalQuantity = currentQuantity + quantity;

    // Check if total quantity meets minimum
    if (totalQuantity < item.minimum_quantity) {
      return {
        hasError: true,
        minimumQuantity: item.minimum_quantity,
        attemptedQuantity: totalQuantity,
        message: `Minimum order quantity for this item is ${item.minimum_quantity} ${item.unit}`,
      };
    }

    return { hasError: false };
  }, [itemsMap]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, quantity = 1): MinimumQuantityError => {
    // Validate minimum quantity first
    const validation = validateMinimumQuantity(item, quantity);
    if (validation.hasError) {
      return validation;
    }

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

    return { hasError: false };
  }, [validateMinimumQuantity]);

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

  const updateItemNote = useCallback((itemId: string, note: string) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.item_id === itemId
          ? { ...item, note }
          : item
      )
    );
  }, []);

  const updateOrderNote = useCallback((note: string) => {
    setOrderNote(note);
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setOrderNote("");
    // Clear from localStorage immediately
    localStorage.removeItem(ORDER_NOTE_STORAGE_KEY);
  }, []);

  // Use Map for O(1) lookup
  const isInCart = useCallback((itemId: string) => {
    return itemsMap.has(itemId);
  }, [itemsMap]);

  // Use Map for O(1) lookup
  const getItemQuantity = useCallback((itemId: string) => {
    return itemsMap.get(itemId)?.quantity || 0;
  }, [itemsMap]);

  // Memoize computed values to prevent recalculation on every render
  const itemCount = useMemo(() => items.length, [items]);
  const subtotal = useMemo(
    () => items.reduce((total, item) => total + item.rate * item.quantity, 0),
    [items]
  );

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(
    () => ({
      items,
      itemCount,
      subtotal,
      currencyCode,
      orderNote,
      addItem,
      removeItem,
      updateQuantity,
      updateItemNote,
      updateOrderNote,
      clearCart,
      isInCart,
      getItemQuantity,
      validateMinimumQuantity,
    }),
    [items, itemCount, subtotal, currencyCode, orderNote, addItem, removeItem, updateQuantity, updateItemNote, updateOrderNote, clearCart, isInCart, getItemQuantity, validateMinimumQuantity]
  );

  return (
    <CartContext.Provider value={contextValue}>
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
