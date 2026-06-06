import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  name: string;
  price: string;
  image: string | null;
  maxStock: number;
  allowBackorder: boolean;
  quantity: number;
  storeSlug: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity' | 'storeSlug'>, storeSlug: string) => void;
  updateQty: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  getItem: (productId: string) => CartItem | undefined;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, storeSlug) => {
        const items = get().items;
        // Scoping: Clear cart if adding item from a different store to prevent cross-store orders
        const hasOtherStoreItems = items.some((i) => i.storeSlug !== storeSlug);
        const currentItems = hasOtherStoreItems ? [] : items;

        const existingItem = currentItems.find((i) => i.productId === item.productId);
        if (existingItem) {
          const newQty = existingItem.quantity + 1;
          // Check stock limit if trackInventory is enabled and backorders are not allowed
          if (!item.allowBackorder && newQty > item.maxStock) {
            return;
          }
          set({
            items: currentItems.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: newQty }
                : i
            ),
          });
        } else {
          set({
            items: [...currentItems, { ...item, quantity: 1, storeSlug }],
          });
        }
      },
      updateQty: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        const item = get().items.find((i) => i.productId === productId);
        if (item && !item.allowBackorder && quantity > item.maxStock) {
          return;
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        });
      },
      removeItem: (productId) => {
        set({
          items: get().items.filter((i) => i.productId !== productId),
        });
      },
      getItem: (productId) => {
        return get().items.find((i) => i.productId === productId);
      },
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'cart-storage',
    }
  )
);
