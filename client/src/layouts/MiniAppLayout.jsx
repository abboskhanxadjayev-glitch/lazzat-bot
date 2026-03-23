import { Link, Outlet } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import { useCart } from "../context/CartContext";
import { useTelegram } from "../hooks/useTelegram";
import { formatCurrency } from "../utils/formatCurrency";

function MiniAppLayout() {
  const { totalItems, totalPrice } = useCart();
  const { displayName } = useTelegram();

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-28 pt-4">
        <header className="rounded-[32px] bg-hero p-5 text-white shadow-2xl shadow-lazzat-maroon/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/60">
                Lazzat style
              </p>
              <Link to="/" className="mt-3 block text-3xl font-bold">
                Lazzat Oshxonasi
              </Link>
              <p className="mt-2 max-w-[15rem] text-sm leading-6 text-white/80">
                Osh, fast food, pitsa, shirinlik va ichimliklar bir joyda.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
                Mijoz
              </p>
              <p className="mt-2 text-right text-sm font-bold">{displayName}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-[24px] border border-white/10 bg-white/10 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                Savat holati
              </p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(totalPrice)}</p>
            </div>
            <span className="rounded-full bg-lazzat-gold px-3 py-2 text-xs font-extrabold text-lazzat-maroon">
              {totalItems} ta
            </span>
          </div>
        </header>

        <main className="flex-1 py-5">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}

export default MiniAppLayout;
