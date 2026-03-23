import { Navigate, Route, Routes } from "react-router-dom";
import MiniAppLayout from "./layouts/MiniAppLayout";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import HomePage from "./pages/HomePage";
import ProductsPage from "./pages/ProductsPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MiniAppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="categories/:categorySlug" element={<ProductsPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  );
}

export default App;
