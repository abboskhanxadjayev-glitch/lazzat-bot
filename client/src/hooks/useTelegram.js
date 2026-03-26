import { useEffect, useMemo, useState } from "react";
import { getTelegramContextSnapshot } from "../utils/telegramWebApp";

function hasSnapshotChanged(currentSnapshot, nextSnapshot) {
  return (
    currentSnapshot.telegramUserId !== nextSnapshot.telegramUserId
    || currentSnapshot.initData !== nextSnapshot.initData
    || currentSnapshot.contextSource !== nextSnapshot.contextSource
    || currentSnapshot.isTelegramWebApp !== nextSnapshot.isTelegramWebApp
    || currentSnapshot.displayName !== nextSnapshot.displayName
    || currentSnapshot.diagnostics.hasInitData !== nextSnapshot.diagnostics.hasInitData
    || currentSnapshot.diagnostics.hasUnsafeUser !== nextSnapshot.diagnostics.hasUnsafeUser
    || currentSnapshot.diagnostics.hasParsedInitUser !== nextSnapshot.diagnostics.hasParsedInitUser
  );
}

export function useTelegram() {
  const [snapshot, setSnapshot] = useState(() => getTelegramContextSnapshot());

  useEffect(() => {
    let isMounted = true;
    let attempts = 0;
    let syncTimerId = null;

    function syncTelegramContext() {
      if (!isMounted) {
        return;
      }

      const nextSnapshot = getTelegramContextSnapshot();
      const telegramApp = nextSnapshot.webApp;

      if (telegramApp) {
        telegramApp.ready();
        telegramApp.expand();
        telegramApp.setHeaderColor?.("#5A0707");
        telegramApp.setBackgroundColor?.("#FFF7EF");
      }

      setSnapshot((currentSnapshot) => (
        hasSnapshotChanged(currentSnapshot, nextSnapshot)
          ? nextSnapshot
          : currentSnapshot
      ));

      attempts += 1;

      if (nextSnapshot.isTelegramWebApp && !nextSnapshot.telegramUserId && attempts < 12) {
        syncTimerId = window.setTimeout(syncTelegramContext, 400);
        return;
      }

      if (!nextSnapshot.telegramUserId) {
        console.info("[telegram] missing Telegram user context", {
          source: nextSnapshot.contextSource,
          diagnostics: nextSnapshot.diagnostics
        });
      }
    }

    syncTelegramContext();

    return () => {
      isMounted = false;
      window.clearTimeout(syncTimerId);
    };
  }, []);

  return useMemo(() => ({
    webApp: snapshot.webApp,
    user: snapshot.user,
    telegramUserId: snapshot.telegramUserId,
    initData: snapshot.initData,
    initDataUnsafe: snapshot.initDataUnsafe,
    isTelegramWebApp: snapshot.isTelegramWebApp,
    displayName: snapshot.displayName,
    contextSource: snapshot.contextSource,
    diagnostics: snapshot.diagnostics
  }), [snapshot]);
}
