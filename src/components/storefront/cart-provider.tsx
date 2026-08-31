"use client";

import * as React from "react";
import { toast } from "sonner";
import type { CartView } from "@/lib/services/cart";
import {
  addToCartAction, applyDiscountAction, removeCartItemAction, updateCartItemAction,
} from "@/app/actions/storefront";
import { useStorefrontSession } from "@/components/storefront/analytics";

type CartContextValue = {
  cart: CartView;
  pending: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  add: (productId: string, variantId: string | null, quantity: number) => Promise<boolean>;
  update: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
  applyDiscount: (code: string | null) => Promise<string | null>;
};

const CartContext = React.createContext<CartContextValue | null>(null);

export function useCart() {
  const context = React.useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}

export function CartProvider({
  storeSlug,
  initialCart,
  children,
}: {
  storeSlug: string;
  initialCart: CartView;
  children: React.ReactNode;
}) {
  const sessionId = useStorefrontSession();
  const [cart, setCart] = React.useState(initialCart);
  const [serverCart, setServerCart] = React.useState(initialCart);
  const [pending, startTransition] = React.useTransition();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // The server re-renders the layout after every mutation. Adopting the new
  // value during render (rather than in an effect) avoids a second paint with
  // stale totals.
  if (initialCart !== serverCart) {
    setServerCart(initialCart);
    setCart(initialCart);
  }

  const add = React.useCallback(
    async (productId: string, variantId: string | null, quantity: number) => {
      const result = await addToCartAction(storeSlug, productId, variantId, quantity, sessionId);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      setCart(result.data);
      setDrawerOpen(true);
      return true;
    },
    [storeSlug, sessionId],
  );

  const update = React.useCallback(
    (itemId: string, quantity: number) => {
      startTransition(async () => {
        const result = await updateCartItemAction(storeSlug, itemId, quantity);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setCart(result.data);
      });
    },
    [storeSlug],
  );

  const remove = React.useCallback(
    (itemId: string) => {
      startTransition(async () => {
        const result = await removeCartItemAction(storeSlug, itemId);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setCart(result.data);
      });
    },
    [storeSlug],
  );

  const applyDiscount = React.useCallback(
    async (code: string | null) => {
      const result = await applyDiscountAction(storeSlug, code);
      if (!result.ok) return result.error;
      setCart(result.data);
      return null;
    },
    [storeSlug],
  );

  const value = React.useMemo<CartContextValue>(
    () => ({ cart, pending, drawerOpen, setDrawerOpen, add, update, remove, applyDiscount }),
    [cart, pending, drawerOpen, add, update, remove, applyDiscount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
