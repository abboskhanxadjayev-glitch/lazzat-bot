import { useEffect, useState } from "react";

export function useTelegram() {
  const [webApp, setWebApp] = useState(() => window.Telegram?.WebApp ?? null);

  useEffect(() => {
    const telegramApp = window.Telegram?.WebApp ?? null;

    if (!telegramApp) {
      return;
    }

    telegramApp.ready();
    telegramApp.expand();
    telegramApp.setHeaderColor?.("#5A0707");
    telegramApp.setBackgroundColor?.("#FFF7EF");
    setWebApp(telegramApp);
  }, []);

  const user = webApp?.initDataUnsafe?.user ?? null;
  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`
    : "Mehmon";

  return {
    webApp,
    user,
    displayName
  };
}
