import { Link, Outlet } from "react-router-dom";

function AdminLayout() {
  return (
    <div className="min-h-screen bg-lazzat-cream">
      <div className="mx-auto min-h-screen max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <header className="surface-card overflow-hidden rounded-[32px] bg-hero px-6 py-6 text-white shadow-2xl shadow-lazzat-maroon/20 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Operator panel</p>
              <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Buyurtmalar boshqaruvi</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
                Lazzat Oshxonasi buyurtmalarini ko'ring, tafsilotlarni tekshiring va statuslarni yangilang.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                Admin MVP
              </span>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              >
                Mijoz ilovasiga o'tish
              </Link>
            </div>
          </div>
        </header>

        <main className="py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;