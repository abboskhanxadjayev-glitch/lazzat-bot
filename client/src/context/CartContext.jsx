import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

const STORAGE_KEY = "lazzat-oshxonasi-cart";
const CartStateContext = createContext(null);
const CartActionsContext = createContext(null);

function getInitialCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistCart(cartItems) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    console.log("[cart] persisted", { items: cartItems.length });
  } catch (error) {
    console.error("[cart] persist failed", error);
  }
}

export function CartProvider({ children }) {
  console.count("CartProvider render");

  const [cartItems, setCartItems] = useState(getInitialCart);

  const addItem = useCallback((product) => {
    console.log("[cart] add item", { productId: product.id });

    setCartItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === product.id);

      if (existingItem) {
        return currentItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...currentItems,
        {
          id: product.id,
          name: product.name,
          description: product.description,
          price: Number(product.price),
          quantity: 1
        }
      ];
    });
  }, []);

  const decrementItem = useCallback((productId) => {
    console.log("[cart] decrement item", { productId });

    setCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity - 1) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId) => {
    console.log("[cart] remove item", { productId });

    setCartItems((currentItems) =>
      currentItems.filter((item) => item.id !== productId)
    );
  }, []);

  const clearCart = useCallback(() => {
    console.log("[cart] clear cart");
    setCartItems([]);
  }, []);

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );
  const totalPrice = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [cartItems]
  );

  useEffect(() => {
    console.log("[cart] state updated", {
      itemKinds: cartItems.length,
      totalItems,
      totalPrice
    });
  }, [cartItems, totalItems, totalPrice]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    console.log("[cart] scheduling persistence", { items: cartItems.length });

    const persist = () => persistCart(cartItems);

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(persist, { timeout: 300 });

      return () => {
        if (typeof window.cancelIdleCallback === "function") {
          window.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(persist, 120);
    return () => window.clearTimeout(timeoutId);
  }, [cartItems]);

  const stateValue = useMemo(
    () => ({
      cartItems,
      totalItems,
      totalPrice
    }),
    [cartItems, totalItems, totalPrice]
  );

  const actionsValue = useMemo(
    () => ({
      addItem,
      decrementItem,
      removeItem,
      clearCart
    }),
    [addItem, decrementItem, removeItem, clearCart]
  );

  return (
    <CartActionsContext.Provider value={actionsValue}>
      <CartStateContext.Provider value={stateValue}>{children}</CartStateContext.Provider>
    </CartActionsContext.Provider>
  );
}

export function useCartState() {
  const context = useContext(CartStateContext);

  if (!context) {
    throw new Error("useCartState must be used within a CartProvider.");
  }

  return context;
}

export function useCartActions() {
  const context = useContext(CartActionsContext);

  if (!context) {
    throw new Error("useCartActions must be used within a CartProvider.");
  }

  return context;
}

export function useCart() {
  return {
    ...useCartState(),
    ...useCartActions()
  };
}
