import { createHash } from "crypto";
import { Markup, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { env } from "../config/env.js";
import {
  ensureCourierRegistrationRecord,
  getCourierProfileByTelegramUserId,
  updateCourierOnlineStatus,
  updateCourierProfile
} from "./courierService.js";

const DEFAULT_MINI_APP_URL = "https://client-chi-nine-98.vercel.app";
const DEFAULT_PRODUCTION_WEBHOOK_BASE_URL = "https://lazzat-bot.onrender.com";
const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook";
const ORDER_BUTTON_LABEL = "\u{1F354} Buyurtma berish";
const COURIER_BUTTON_LABEL = "\u{1F69A} Kuryer bo'lish";
const OPEN_COURIER_PANEL_LABEL = "\u{1F69A} Courier panelni ochish";
const ONLINE_BUTTON_LABEL = "\u{1F7E2} Online bo'lish";
const OFFLINE_BUTTON_LABEL = "\u26AA Offline bo'lish";
const SHARE_CONTACT_LABEL = "\u{1F4F1} Telefonni ulashish";
const CANCEL_BUTTON_LABEL = "\u2B05 Bekor qilish";
const PHONE_PATTERN = /^[+]?[-()\d\s]{7,20}$/;
const RESERVED_TEXT_BUTTONS = new Set([COURIER_BUTTON_LABEL, ONLINE_BUTTON_LABEL, OFFLINE_BUTTON_LABEL, CANCEL_BUTTON_LABEL]);
const onboardingState = new Map();

const TRANSPORT_OPTIONS = [
  { label: "Piyoda", value: "foot" },
  { label: "Velik", value: "bike" },
  { label: "Moto", value: "moto" },
  { label: "Avto", value: "car" }
];

const TRANSPORT_LABELS = {
  foot: "Piyoda",
  bike: "Velik",
  moto: "Moto",
  car: "Avto"
};

const STATUS_LABELS = {
  pending: "Tasdiqlash kutilmoqda",
  approved: "Tasdiqlangan",
  blocked: "Bloklangan"
};

const ONLINE_STATUS_LABELS = {
  online: "Online",
  offline: "Offline"
};

const BOT_COMMANDS = [
  { command: "start", description: "Asosiy menyuni ochish" },
  { command: "menu", description: "Menyuni ko'rsatish" },
  { command: "help", description: "Yordam va tugmalar" },
  { command: "courier", description: "Kuryer onboardingini boshlash" },
  { command: "myid", description: "Telegram ID va kuryer holati" }
];

let botRuntime = null;

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function resolveBotConfig() {
  const token = process.env.BOT_TOKEN || env.telegramBotToken || "";
  const miniAppUrl = process.env.MINI_APP_URL || DEFAULT_MINI_APP_URL;
  const normalizedMiniAppUrl = trimTrailingSlash(miniAppUrl);
  const configuredBaseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL
    || process.env.PUBLIC_BASE_URL
    || process.env.APP_BASE_URL
    || process.env.RENDER_EXTERNAL_URL
    || (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_WEBHOOK_BASE_URL : "");

  return {
    token,
    normalizedMiniAppUrl,
    courierMiniAppUrl: `${normalizedMiniAppUrl}/courier`,
    webhookBaseUrl: configuredBaseUrl ? trimTrailingSlash(configuredBaseUrl) : ""
  };
}

function getWebhookSecret(token) {
  return process.env.TELEGRAM_WEBHOOK_SECRET
    || createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function mapTelegramUser(user) {
  if (!user?.id) {
    return null;
  }

  return {
    id: Number(user.id),
    username: user.username || null,
    firstName: user.first_name || null,
    lastName: user.last_name || null
  };
}

function formatTransportType(value) {
  return TRANSPORT_LABELS[value] || "Kiritilmagan";
}

function formatCourierStatus(value) {
  return STATUS_LABELS[value] || value || "Ro'yxatdan o'tmagan";
}

function formatOnlineStatus(value) {
  return ONLINE_STATUS_LABELS[value] || value || "Offline";
}

function getMainKeyboard(config) {
  return Markup.keyboard([
    [Markup.button.webApp(ORDER_BUTTON_LABEL, config.normalizedMiniAppUrl)],
    [Markup.button.text(COURIER_BUTTON_LABEL)]
  ]).resize();
}

function getPhoneKeyboard() {
  return Markup.keyboard([
    [Markup.button.contactRequest(SHARE_CONTACT_LABEL)],
    [Markup.button.text(CANCEL_BUTTON_LABEL)]
  ]).resize().oneTime();
}

function getTransportKeyboard() {
  return Markup.keyboard([
    TRANSPORT_OPTIONS.slice(0, 2).map((option) => Markup.button.text(option.label)),
    TRANSPORT_OPTIONS.slice(2, 4).map((option) => Markup.button.text(option.label)),
    [Markup.button.text(CANCEL_BUTTON_LABEL)]
  ]).resize().oneTime();
}

function getCourierPanelKeyboard(courier, config) {
  const toggleButtons = courier?.status === "approved"
    ? [Markup.button.text(ONLINE_BUTTON_LABEL), Markup.button.text(OFFLINE_BUTTON_LABEL)]
    : [];

  const rows = [
    [Markup.button.webApp(OPEN_COURIER_PANEL_LABEL, config.courierMiniAppUrl)]
  ];

  if (toggleButtons.length) {
    rows.push(toggleButtons);
  }

  rows.push([
    Markup.button.webApp(ORDER_BUTTON_LABEL, config.normalizedMiniAppUrl),
    Markup.button.text(COURIER_BUTTON_LABEL)
  ]);

  return Markup.keyboard(rows).resize();
}

function setOnboardingState(userId, step, courierId) {
  onboardingState.set(String(userId), { step, courierId });
}

function getOnboardingState(userId) {
  return onboardingState.get(String(userId)) || null;
}

function clearOnboardingState(userId) {
  onboardingState.delete(String(userId));
}

function getCourierFlowStep(courier) {
  if (!courier) {
    return "new";
  }

  if (courier.status === "blocked") {
    return "blocked";
  }

  if (!courier.phone) {
    return "phone";
  }

  if (!courier.transportType) {
    return "transport";
  }

  if (courier.status === "approved") {
    return "approved";
  }

  return "pending";
}

function buildCourierSummary(courier) {
  return [
    `ID: ${courier.telegramUserId}`,
    `Holat: ${formatCourierStatus(courier.status)}`,
    `Telefon: ${courier.phone || "Kiritilmagan"}`,
    `Transport: ${formatTransportType(courier.transportType)}`,
    `Online: ${formatOnlineStatus(courier.onlineStatus)}`
  ].join("\n");
}

function getHelpText() {
  return [
    "Lazzat Oshxonasi boti.",
    "",
    "\u2022 Buyurtma berish uchun: 🍔 Buyurtma berish",
    "\u2022 Kuryer onboardingi uchun: 🚚 Kuryer bo'lish",
    "\u2022 Telegram ID ni ko'rish uchun: /myid"
  ].join("\n");
}

function getApiErrorMessage(error, fallbackMessage) {
  if (error?.details?.code === "COURIER_PROFILE_SCHEMA_NOT_READY") {
    return "Kuryer profil maydonlari hali tayyor emas. Iltimos, operator bilan bog'laning.";
  }

  if (error?.details?.code === "COURIER_BLOCKED") {
    return "Sizning kuryer profilingiz bloklangan. Operator bilan bog'laning.";
  }

  if (error?.details?.code === "COURIER_NOT_APPROVED") {
    return "Faqat tasdiqlangan kuryer online bo'la oladi.";
  }

  return error?.message || fallbackMessage;
}

async function getOrCreateCourier(ctx) {
  const telegramUser = mapTelegramUser(ctx.from);

  if (!telegramUser) {
    throw new Error("Telegram foydalanuvchi ma'lumotlari topilmadi.");
  }

  return ensureCourierRegistrationRecord({ telegramUser });
}

async function loadCourierProfile(ctx) {
  if (!ctx.from?.id) {
    return null;
  }

  return getCourierProfileByTelegramUserId(ctx.from.id);
}

async function sendCourierEntryState(ctx, courier, config, options = {}) {
  const { messagePrefix = "" } = options;
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply("Telegram foydalanuvchi ma'lumotlari topilmadi.", getMainKeyboard(config));
    return;
  }

  const step = getCourierFlowStep(courier);

  if (step === "phone") {
    setOnboardingState(userId, "phone", courier.id);
    await ctx.reply(
      `${messagePrefix}Kuryer bo'lib ro'yxatdan o'tish uchun telefon raqamingizni yuboring yoki tugma orqali ulashing.`,
      getPhoneKeyboard()
    );
    return;
  }

  if (step === "transport") {
    setOnboardingState(userId, "transport", courier.id);
    await ctx.reply(`${messagePrefix}Transport turini tanlang.`, getTransportKeyboard());
    return;
  }

  clearOnboardingState(userId);

  if (step === "blocked") {
    await ctx.reply(`${messagePrefix}Kuryer profilingiz bloklangan. Operator bilan bog'laning.`, getMainKeyboard(config));
    return;
  }

  if (step === "approved") {
    await ctx.reply(
      `${messagePrefix}Siz tasdiqlangan kuryersiz.\n\n${buildCourierSummary(courier)}`,
      getCourierPanelKeyboard(courier, config)
    );
    return;
  }

  await ctx.reply(
    `${messagePrefix}Tasdiqlash kutilmoqda. Admin tasdiqlagach courier paneldan foydalanishingiz mumkin.\n\n${buildCourierSummary(courier)}`,
    getCourierPanelKeyboard(courier, config)
  );
}

async function handleCourierEntry(ctx, config) {
  try {
    const courier = await getOrCreateCourier(ctx);
    await sendCourierEntryState(ctx, courier, config);
  } catch (error) {
    console.error("[telegram-bot] courier entry error", error);
    await ctx.reply(getApiErrorMessage(error, "Kuryer onboardingini boshlashda xatolik yuz berdi."), getMainKeyboard(config));
  }
}

async function handlePhoneCapture(ctx, phoneNumber, config) {
  const userId = ctx.from?.id;

  if (!userId) {
    return;
  }

  let courier = await loadCourierProfile(ctx);

  if (!courier) {
    courier = await getOrCreateCourier(ctx);
  }

  const normalizedPhone = phoneNumber.trim();

  if (!PHONE_PATTERN.test(normalizedPhone)) {
    await ctx.reply("Telefon raqamini to'g'ri formatda yuboring. Masalan: +998 90 123 45 67", getPhoneKeyboard());
    return;
  }

  try {
    const updatedCourier = await updateCourierProfile(courier.id, {
      phone: normalizedPhone
    });
    setOnboardingState(userId, "transport", updatedCourier.id);
    await ctx.reply("Rahmat. Endi transport turini tanlang.", getTransportKeyboard());
  } catch (error) {
    console.error("[telegram-bot] phone capture error", error);
    await ctx.reply(getApiErrorMessage(error, "Telefonni saqlab bo'lmadi."), getMainKeyboard(config));
  }
}

async function handleTransportSelection(ctx, transportType, config) {
  const userId = ctx.from?.id;

  if (!userId) {
    return;
  }

  let courier = await loadCourierProfile(ctx);

  if (!courier) {
    courier = await getOrCreateCourier(ctx);
  }

  try {
    const updatedCourier = await updateCourierProfile(courier.id, {
      transportType,
      submitForApproval: true
    });

    clearOnboardingState(userId);
    await ctx.reply(
      `Ro'yxatdan o'tish yakunlandi. Admin tasdiqlashi kerak.\n\n${buildCourierSummary(updatedCourier)}`,
      getCourierPanelKeyboard(updatedCourier, config)
    );
  } catch (error) {
    console.error("[telegram-bot] transport selection error", error);
    await ctx.reply(getApiErrorMessage(error, "Transport turini saqlab bo'lmadi."), getMainKeyboard(config));
  }
}

async function handleOnlineToggle(ctx, onlineStatus, config) {
  try {
    const courier = await loadCourierProfile(ctx);

    if (!courier) {
      await ctx.reply("Avval kuryer sifatida ro'yxatdan o'ting.", getMainKeyboard(config));
      return;
    }

    const updatedCourier = await updateCourierOnlineStatus(courier.id, onlineStatus);
    const messageText = onlineStatus === "online"
      ? "Siz online holatga o'tdingiz."
      : "Siz offline holatga o'tdingiz.";

    await ctx.reply(`${messageText}\n\n${buildCourierSummary(updatedCourier)}`, getCourierPanelKeyboard(updatedCourier, config));
  } catch (error) {
    console.error("[telegram-bot] online toggle error", error);
    await ctx.reply(getApiErrorMessage(error, "Online holatini yangilab bo'lmadi."), getMainKeyboard(config));
  }
}

function createTelegramBot(config) {
  const bot = new Telegraf(config.token);

  bot.start(async (ctx) => {
    clearOnboardingState(ctx.from?.id);
    await ctx.reply(
      "Lazzat Oshxonasi botiga xush kelibsiz. Buyurtma berish yoki kuryer sifatida ro'yxatdan o'tish uchun quyidagi tugmalardan foydalaning.",
      getMainKeyboard(config)
    );
  });

  bot.command("menu", async (ctx) => {
    await ctx.reply("Buyurtma berish uchun quyidagi tugmani bosing.", getMainKeyboard(config));
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(getHelpText(), getMainKeyboard(config));
  });

  bot.command("cart", async (ctx) => {
    await ctx.reply("Savatcha va buyurtma uchun Mini Appni oching.", getMainKeyboard(config));
  });

  bot.command("courier", async (ctx) => handleCourierEntry(ctx, config));

  bot.command("myid", async (ctx) => {
    if (!ctx.from?.id) {
      await ctx.reply("Telegram foydalanuvchi ma'lumotlari topilmadi.", getMainKeyboard(config));
      return;
    }

    try {
      const courier = await loadCourierProfile(ctx);
      const lines = [`Telegram ID: ${ctx.from.id}`];

      if (courier) {
        lines.push(buildCourierSummary(courier));
      } else {
        lines.push("Courier profili topilmadi.");
      }

      await ctx.reply(lines.join("\n\n"), getMainKeyboard(config));
    } catch (error) {
      console.error("[telegram-bot] myid error", error);
      await ctx.reply(getApiErrorMessage(error, "Telegram ID ni tekshirib bo'lmadi."), getMainKeyboard(config));
    }
  });

  bot.hears(COURIER_BUTTON_LABEL, async (ctx) => handleCourierEntry(ctx, config));
  bot.hears(ONLINE_BUTTON_LABEL, async (ctx) => handleOnlineToggle(ctx, "online", config));
  bot.hears(OFFLINE_BUTTON_LABEL, async (ctx) => handleOnlineToggle(ctx, "offline", config));
  bot.hears(CANCEL_BUTTON_LABEL, async (ctx) => {
    clearOnboardingState(ctx.from?.id);
    await ctx.reply("Kuryer onboardingi bekor qilindi.", getMainKeyboard(config));
  });

  bot.on(message("contact"), async (ctx) => {
    const state = getOnboardingState(ctx.from?.id);

    if (!state || state.step !== "phone") {
      return;
    }

    await handlePhoneCapture(ctx, ctx.message.contact.phone_number || "", config);
  });

  bot.on(message("text"), async (ctx) => {
    const text = ctx.message.text.trim();
    const state = getOnboardingState(ctx.from?.id);

    if (!state || text.startsWith("/") || RESERVED_TEXT_BUTTONS.has(text)) {
      return;
    }

    if (state.step === "phone") {
      await handlePhoneCapture(ctx, text, config);
      return;
    }

    if (state.step === "transport") {
      const selectedTransport = TRANSPORT_OPTIONS.find((option) => option.label === text);

      if (!selectedTransport) {
        await ctx.reply("Transport turini tugmalar orqali tanlang.", getTransportKeyboard());
        return;
      }

      await handleTransportSelection(ctx, selectedTransport.value, config);
    }
  });

  bot.catch((error) => {
    console.error("[telegram-bot] runtime error", error);
  });

  return bot;
}

async function syncBotConfiguration(bot, config) {
  await bot.telegram.setMyCommands(BOT_COMMANDS);
  await bot.telegram.setChatMenuButton({
    menuButton: {
      type: "web_app",
      text: ORDER_BUTTON_LABEL,
      web_app: {
        url: config.normalizedMiniAppUrl
      }
    }
  });
}

export async function registerTelegramBotWebhook(app) {
  const config = resolveBotConfig();

  if (!config.token) {
    console.warn("[telegram-bot] webhook disabled: TELEGRAM_BOT_TOKEN/BOT_TOKEN missing.");
    return null;
  }

  const webhookSecret = getWebhookSecret(config.token);
  const bot = createTelegramBot(config);

  app.post(TELEGRAM_WEBHOOK_PATH, async (req, res) => {
    const requestSecret = req.get("x-telegram-bot-api-secret-token") || "";

    if (requestSecret !== webhookSecret) {
      res.status(403).json({ message: "Telegram webhook secret is invalid." });
      return;
    }

    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ message: "Telegram update payload is missing." });
      return;
    }

    try {
      await bot.handleUpdate(req.body, res);

      if (!res.headersSent) {
        res.status(200).json({ ok: true });
      }
    } catch (error) {
      console.error("[telegram-bot] webhook update error", error);

      if (!res.headersSent) {
        res.status(500).json({ message: "Telegram webhook handling failed." });
      }
    }
  });

  botRuntime = {
    bot,
    config,
    webhookSecret
  };

  console.log(`[telegram-bot] webhook route registered at ${TELEGRAM_WEBHOOK_PATH}`);
  return botRuntime;
}

export async function syncTelegramBotWebhook() {
  if (!botRuntime) {
    return {
      enabled: false,
      reason: "route-not-registered"
    };
  }

  await syncBotConfiguration(botRuntime.bot, botRuntime.config);

  if (!botRuntime.config.webhookBaseUrl) {
    console.warn("[telegram-bot] webhook sync skipped: TELEGRAM_WEBHOOK_BASE_URL/RENDER_EXTERNAL_URL not available.");
    return {
      enabled: false,
      reason: "missing-public-base-url"
    };
  }

  const webhookUrl = `${botRuntime.config.webhookBaseUrl}${TELEGRAM_WEBHOOK_PATH}`;

  await botRuntime.bot.telegram.setWebhook(webhookUrl, {
    secret_token: botRuntime.webhookSecret,
    drop_pending_updates: false
  });

  console.log(`[telegram-bot] webhook synced to ${webhookUrl}`);

  return {
    enabled: true,
    webhookUrl
  };
}
