import { NavLink } from "react-router-dom";
import { useCartState } from "../context/CartContext";

const links = [
  { to: "/", label: "Bosh sahifa" },
  { to: "/cart", label: "Savat" },
  { to: "/orders", label: "Buyurtmalar" }
];

function BottomNav() {
  console.count("BottomNav render");

  const { totalItems } = useCartState();

  return (
    <nav className="fixed inset-x-0 bottom-4 z-50 px-4">
      <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-lazzat-gold/25 bg-lazzat-maroon px-2 py-2 shadow-2xl shadow-lazzat-maroon/30">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              [
                "flex min-w-0 flex-1 items-center justify-center rounded-full px-2 py-3 text-[11px] font-bold leading-tight transition",
                isActive
                  ? "bg-white text-lazzat-maroon"
                  : "text-white/75 hover:text-white"
              ].join(" ")
            }
          >
            <span className="truncate">{link.label}</span>
            {link.to === "/cart" && totalItems > 0 ? (
              <span className="ml-2 rounded-full bg-lazzat-gold px-2 py-0.5 text-[10px] text-lazzat-maroon">
                {totalItems}
              </span>
            ) : null}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default BottomNav;