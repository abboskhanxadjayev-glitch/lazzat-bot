import { Link, NavLink, Outlet } from "react-router-dom";

const adminLinks = [
  { to: "/admin/orders", label: "Buyurtmalar" },
  { to: "/admin/couriers", label: "Kuryerlar" }
];

function AdminLayout() {
  return (
    <div className="min-h-screen bg-lazzat-cream">
      <div className="mx-auto min-h-screen max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <header className="surface-card overflow-hidden rounded-[32px] bg-hero px-6 py-6 text-white shadow-2xl shadow-lazzat-maroon/20 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Operator panel</p>
              <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Lazzat operator boshqaruvi</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
                Buyurtmalarni boshqaring, kuryerlarni tasdiqlang va yetkazmalarni biriktiring.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                Admin MVP+
              </span>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              >
                Mijoz ilovasiga o'tish
              </Link>
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap gap-3">
            {adminLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => [
                  "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-bold transition",
                  isActive
                    ? "border-white bg-white text-lazzat-maroon"
                    : "border-white/25 bg-white/10 text-white hover:bg-white/15"
                ].join(" ")}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
