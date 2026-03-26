import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { loginCourier } from "../api/client";
import PageHeader from "../components/PageHeader";
import { useCourierSession } from "../hooks/useCourierSession";

function CourierLoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, saveSession } = useCourierSession();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (isAuthenticated) {
    return <Navigate replace to="/courier-dashboard" />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const authResult = await loginCourier({
        phone: phone.trim(),
        password: password.trim()
      });

      saveSession({
        token: authResult.token,
        courier: authResult.courier
      });
      navigate("/courier-dashboard", { replace: true });
    } catch (error) {
      console.error("[courier-login] login error", error);
      setErrorMessage(error.message || "Kirishni bajarib bo'lmadi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFormReady = phone.trim().length >= 7 && password.trim().length >= 6;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(196,30,58,0.12),_transparent_40%),linear-gradient(180deg,#fffaf5_0%,#fff5ec_100%)] px-4 py-5">
      <div className="mx-auto max-w-md space-y-5">
        <section className="rounded-[32px] bg-hero p-5 text-white shadow-2xl shadow-lazzat-maroon/25">
          <p className="text-xs uppercase tracking-[0.28em] text-white/60">Courier portal</p>
          <h1 className="mt-3 text-3xl font-bold">Lazzat Oshxonasi</h1>
          <p className="mt-2 text-sm leading-6 text-white/80">
            Tasdiqlangan kuryerlar web panel orqali kiradi. Login ma'lumotlari Telegram bot orqali yuboriladi.
          </p>
        </section>

        <section className="surface-card rounded-[32px] p-6 sm:p-7">
          <PageHeader
            eyebrow="Kuryer"
            title="Kuryer panelga kirish"
            description="Telefon raqamingiz va admin yuborgan parol bilan tizimga kiring."
          />

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/65">
                Telefon
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="field-input"
                placeholder="+998 90 123 45 67"
                autoComplete="tel"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.16em] text-lazzat-red/65">
                Parol
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field-input"
                placeholder="Vaqtinchalik yoki doimiy parol"
                autoComplete="current-password"
              />
            </label>

            <button
              type="submit"
              disabled={!isFormReady || isSubmitting}
              className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Kirilmoqda..." : "Kirish"}
            </button>
          </form>
        </section>

        {errorMessage ? (
          <section className="surface-card rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            {errorMessage}
          </section>
        ) : null}

        <section className="surface-card rounded-[28px] border border-lazzat-gold/20 bg-white/80 p-5 text-sm leading-6 text-lazzat-ink/70">
          <p className="font-bold text-lazzat-maroon">Kirish bo'yicha yordam</p>
          <p className="mt-2">
            Agar parol sizga hali kelmagan bo'lsa, Telegram botdagi <span className="font-semibold">/courier</span> buyrug'ini yuboring yoki admin bilan bog'laning.
          </p>
        </section>
      </div>
    </div>
  );
}

export default CourierLoginPage;
