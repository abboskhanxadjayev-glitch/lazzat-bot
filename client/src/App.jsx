import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import MiniAppLayout from "./layouts/MiniAppLayout";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import CourierPage from "./pages/CourierPage";
import HomePage from "./pages/HomePage";
import AdminCouriersPage from "./pages/AdminCouriersPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import OrdersPage from "./pages/OrdersPage";
import ProductsPage from "./pages/ProductsPage";

function AppRoutes() {
  const location = useLocation();

  console.count("AppRoutes render");

  useEffect(() => {
    console.log("[route] transition", location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="couriers" element={<AdminCouriersPage />} />
        <Route path="*" element={<Navigate replace to="/admin/orders" />} />
      </Route>

      <Route path="/" element={<MiniAppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="categories/:categorySlug" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="courier" element={<CourierPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}

function App() {
  return <AppRoutes />;
}

export default App;
