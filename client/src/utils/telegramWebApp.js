function safeParseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("[telegram] failed to parse JSON payload", error);
    return null;
  }
}

const TELEGRAM_CONTEXT_STORAGE_KEY = "lazzat.telegram.context";

function normalizeTelegramUser(rawUser) {
  if (!rawUser?.id) {
    return null;
  }

  const normalizedId = Number(rawUser.id);

  if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
    return null;
  }

  return {
    id: normalizedId,
    username: rawUser.username || null,
    first_name: rawUser.first_name || rawUser.firstName || null,
    last_name: rawUser.last_name || rawUser.lastName || null
  };
}

function readStoredTelegramContext() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return safeParseJson(window.sessionStorage.getItem(TELEGRAM_CONTEXT_STORAGE_KEY));
  } catch (error) {
    console.warn("[telegram] failed to read stored Telegram context", error);
    return null;
  }
}

function persistTelegramContext(context) {
  if (typeof window === "undefined") {
    return;
  }

  if (!context?.initData || !context?.user?.id) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      TELEGRAM_CONTEXT_STORAGE_KEY,
      JSON.stringify({
        initData: context.initData,
        user: context.user,
        cachedAt: new Date().toISOString()
      })
    );
  } catch (error) {
    console.warn("[telegram] failed to persist Telegram context", error);
  }
}

function getTelegramLaunchParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  const searchParams = new URLSearchParams(window.location.search || "");

  if (searchParams.get("tgWebAppData")) {
    return searchParams;
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  if (!hash) {
    return searchParams;
  }

  const hashParams = new URLSearchParams(hash);

  if (hashParams.get("tgWebAppData")) {
    return hashParams;
  }

  return searchParams;
}

function getInitDataFromLaunchParams() {
  const launchParams = getTelegramLaunchParams();
  const rawInitData = launchParams.get("tgWebAppData") || "";

  if (!rawInitData) {
    return "";
  }

  try {
    return decodeURIComponent(rawInitData);
  } catch {
    return rawInitData;
  }
}

function parseInitData(initData) {
  if (!initData) {
    return {
      user: null,
      chat: null,
      startParam: ""
    };
  }

  const params = new URLSearchParams(initData);

  return {
    user: normalizeTelegramUser(safeParseJson(params.get("user"))),
    chat: safeParseJson(params.get("chat")),
    startParam: params.get("start_param") || ""
  };
}

function getDisplayName(user) {
  if (!user) {
    return "Mehmon";
  }

  if (user.first_name) {
    return `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`;
  }

  if (user.username) {
    return `@${user.username}`;
  }

  return "Mehmon";
}

export function getTelegramContextSnapshot() {
  if (typeof window === "undefined") {
    return {
      webApp: null,
      user: null,
      telegramUserId: null,
      initData: "",
      initDataUnsafe: {},
      isTelegramWebApp: false,
      displayName: "Mehmon",
      contextSource: "server",
      diagnostics: {
        hasTelegramObject: false,
        hasWebAppObject: false,
        hasInitData: false,
        hasUnsafeUser: false,
        hasParsedInitUser: false,
        hasLaunchParams: false,
        hasStoredContext: false
      }
    };
  }

  const telegram = window.Telegram || null;
  const webApp = telegram?.WebApp ?? null;
  const launchInitData = getInitDataFromLaunchParams();
  const storedContext = readStoredTelegramContext();
  const storedInitData = storedContext?.initData || "";
  const shouldUseStoredInitData = Boolean(webApp && !webApp.initData && !launchInitData && storedInitData);
  const initData = webApp?.initData || launchInitData || (shouldUseStoredInitData ? storedInitData : "");
  const initDataUnsafe = webApp?.initDataUnsafe || {};
  const parsedInitData = parseInitData(initData);
  const unsafeUser = normalizeTelegramUser(initDataUnsafe.user);
  const storedUser = normalizeTelegramUser(storedContext?.user);
  const parsedUser = parsedInitData.user;
  const user = unsafeUser || parsedUser || (shouldUseStoredInitData ? storedUser : null);

  let contextSource = "missing";

  if (unsafeUser) {
    contextSource = "initDataUnsafe.user";
  } else if (parsedUser) {
    if (webApp?.initData) {
      contextSource = "initData";
    } else if (launchInitData) {
      contextSource = "launch-params";
    } else {
      contextSource = "session-cache";
    }
  } else if (shouldUseStoredInitData && storedUser) {
    contextSource = "session-cache";
  } else if (webApp) {
    contextSource = "webapp-no-user";
  }

  if (user && initData) {
    persistTelegramContext({ initData, user });
  }

  return {
    webApp,
    user,
    telegramUserId: user?.id ?? null,
    initData,
    initDataUnsafe,
    isTelegramWebApp: Boolean(webApp),
    displayName: getDisplayName(user),
    contextSource,
    diagnostics: {
      hasTelegramObject: Boolean(telegram),
      hasWebAppObject: Boolean(webApp),
      hasInitData: Boolean(initData),
      hasUnsafeUser: Boolean(unsafeUser),
      hasParsedInitUser: Boolean(parsedUser),
      hasLaunchParams: Boolean(launchInitData),
      hasStoredContext: Boolean(storedContext?.initData)
    }
  };
}

export function getTelegramHeaders(explicitTelegramUserId = null) {
  const snapshot = getTelegramContextSnapshot();
  const headers = {};
  const telegramUserId = explicitTelegramUserId || snapshot.telegramUserId;

  if (telegramUserId) {
    headers["x-telegram-user-id"] = String(telegramUserId);
  }

  if (snapshot.initData) {
    headers["x-telegram-init-data"] = snapshot.initData;
  }

  return headers;
}
