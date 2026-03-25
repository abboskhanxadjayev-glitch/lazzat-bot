import "dotenv/config";
import { Markup, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { pathToFileURL } from "url";
import {
  API_BASE_URL,
  ensureCourier,
  getCourierProfile,
  updateCourierOnlineStatus,
  updateCourierProfile
} from "./api.js";

const ORDER_BUTTON_LABEL = "\u{1F354} Buyurtma berish";
const COURIER_BUTTON_LABEL = "\u{1F69A} Kuryer bo'lish";
const OPEN_COURIER_PANEL_LABEL = "\u{1F69A} Courier panelni ochish";
const ONLINE_BUTTON_LABEL = "\u{1F7E2} Online bo'lish";
const OFFLINE_BUTTON_LABEL = "\u26AA Offline bo'lish";
const SHARE_CONTACT_LABEL = "\u{1F4F1} Telefonni ulashish";
const CANCEL_BUTTON_LABEL = "\u2B05 Bekor qilish";
const PHONE_PATTERN = /^[+]?[-()\d\s]{7,20}$/;
const RESERVED_TEXT_BUTTONS = new Set([COURIER_BUTTON_LABEL, ONLINE_BUTTON_LABEL, OFFLINE_BUTTON_LABEL, CANCEL_BUTTON_LABEL]);

const token = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL || "https://client-chi-nine-98.vercel.app";
const normalizedMiniAppUrl = miniAppUrl.replace(/\/+$/, "");
const courierMiniAppUrl = `${normalizedMiniAppUrl}/courier`;
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

if (!token) {
  console.error("BOT_TOKEN topilmadi. bot/.env faylini to'ldiring.");
  process.exit(1);
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

function getDisplayName(user) {
  const parts = [user?.first_name, user?.last_name].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }

  return user?.username ? `@${user.username}` : "Kuryer";
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

function mainKeyboard() {
  return Markup.keyboard([
    [Markup.button.webApp(ORDER_BUTTON_LABEL, normalizedMiniAppUrl)],
    [Markup.button.text(COURIER_BUTTON_LABEL)]
  ]).resize();
}

function phoneKeyboard() {
  return Markup.keyboard([
    [Markup.button.contactRequest(SHARE_CONTACT_LABEL)],
    [Markup.button.text(CANCEL_BUTTON_LABEL)]
  ]).resize().oneTime();
}

function transportKeyboard() {
  return Markup.keyboard([
    TRANSPORT_OPTIONS.slice(0, 2).map((option) => Markup.button.text(option.label)),
    TRANSPORT_OPTIONS.slice(2, 4).map((option) => Markup.button.text(option.label)),
    [Markup.button.text(CANCEL_BUTTON_LABEL)]
  ]).resize().oneTime();
}

function courierPanelKeyboard(courier) {
  const toggleButtons = courier?.status === "approved"
    ? [Markup.button.text(ONLINE_BUTTON_LABEL), Markup.button.text(OFFLINE_BUTTON_LABEL)]
    : [];

  const rows = [
    [Markup.button.webApp(OPEN_COURIER_PANEL_LABEL, courierMiniAppUrl)]
  ];

  if (toggleButtons.length) {
    rows.push(toggleButtons);
  }

  rows.push([
    Markup.button.webApp(ORDER_BUTTON_LABEL, normalizedMiniAppUrl),
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

  return ensureCourier(telegramUser);
}

async function loadCourierProfile(ctx) {
  if (!ctx.from?.id) {
    return null;
  }

  return getCourierProfile(ctx.from.id);
}

async function sendCourierEntryState(ctx, courier, options = {}) {
  const { messagePrefix = "" } = options;
  const userId = ctx.from?.id;

  if (!userId) {
    await ctx.reply("Telegram foydalanuvchi ma'lumotlari topilmadi.", mainKeyboard());
    return;
  }

  const step = getCourierFlowStep(courier);

  if (step === "phone") {
    setOnboardingState(userId, "phone", courier.id);
    await ctx.reply(
      `${messagePrefix}Kuryer bo'lib ro'yxatdan o'tish uchun telefon raqamingizni yuboring yoki tugma orqali ulashing.`,
      phoneKeyboard()
    );
    return;
  }

  if (step === "transport") {
    setOnboardingState(userId, "transport", courier.id);
    await ctx.reply(
      `${messagePrefix}Transport turini tanlang.`,
      transportKeyboard()
    );
    return;
  }

  clearOnboardingState(userId);

  if (step === "blocked") {
    await ctx.reply(
      `${messagePrefix}Kuryer profilingiz bloklangan. Operator bilan bog'laning.`,
      mainKeyboard()
    );
    return;
  }

  if (step === "approved") {
    await ctx.reply(
      `${messagePrefix}Siz tasdiqlangan kuryersiz.\n\n${buildCourierSummary(courier)}`,
      courierPanelKeyboard(courier)
    );
    return;
  }

  await ctx.reply(
    `${messagePrefix}Tasdiqlash kutilmoqda. Admin tasdiqlagach courier paneldan foydalanishingiz mumkin.\n\n${buildCourierSummary(courier)}`,
    courierPanelKeyboard(courier)
  );
}

async function handleCourierEntry(ctx) {
  try {
    const courier = await getOrCreateCourier(ctx);
    await sendCourierEntryState(ctx, courier);
  } catch (error) {
    console.error("[bot] courier entry error", error);
    await ctx.reply(getApiErrorMessage(error, "Kuryer onboardingini boshlashda xatolik yuz berdi."), mainKeyboard());
  }
}

async function handlePhoneCapture(ctx, phoneNumber) {
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
    await ctx.reply("Telefon raqamini to'g'ri formatda yuboring. Masalan: +998 90 123 45 67", phoneKeyboard());
    return;
  }

  try {
    const updatedCourier = await updateCourierProfile(courier.id, {
      phone: normalizedPhone
    });
    setOnboardingState(userId, "transport", updatedCourier.id);
    await ctx.reply("Rahmat. Endi transport turini tanlang.", transportKeyboard());
  } catch (error) {
    console.error("[bot] phone capture error", error);
    await ctx.reply(getApiErrorMessage(error, "Telefonni saqlab bo'lmadi."), mainKeyboard());
  }
}

async function handleTransportSelection(ctx, transportType) {
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
      courierPanelKeyboard(updatedCourier)
    );
  } catch (error) {
    console.error("[bot] transport selection error", error);
    await ctx.reply(getApiErrorMessage(error, "Transport turini saqlab bo'lmadi."), mainKeyboard());
  }
}

async function handleOnlineToggle(ctx, onlineStatus) {
  try {
    const courier = await loadCourierProfile(ctx);

    if (!courier) {
      await ctx.reply("Avval kuryer sifatida ro'yxatdan o'ting.", mainKeyboard());
      return;
    }

    const updatedCourier = await updateCourierOnlineStatus(courier.id, onlineStatus);
    const messageText = onlineStatus === "online"
      ? "Siz online holatga o'tdingiz."
      : "Siz offline holatga o'tdingiz.";

    await ctx.reply(`${messageText}\n\n${buildCourierSummary(updatedCourier)}`, courierPanelKeyboard(updatedCourier));
  } catch (error) {
    console.error("[bot] online toggle error", error);
    await ctx.reply(getApiErrorMessage(error, "Online holatini yangilab bo'lmadi."), mainKeyboard());
  }
}

export function createBot() {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    clearOnboardingState(ctx.from?.id);
    await ctx.reply(
      "Lazzat Oshxonasi botiga xush kelibsiz. Buyurtma berish yoki kuryer sifatida ro'yxatdan o'tish uchun quyidagi tugmalardan foydalaning.",
      mainKeyboard()
    );
  });

  bot.command("menu", async (ctx) => {
    await ctx.reply("Buyurtma berish uchun quyidagi tugmani bosing.", mainKeyboard());
  });

  bot.command("courier", handleCourierEntry);

  bot.command("myid", async (ctx) => {
    if (!ctx.from?.id) {
      await ctx.reply("Telegram foydalanuvchi ma'lumotlari topilmadi.", mainKeyboard());
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

      await ctx.reply(lines.join("\n\n"), mainKeyboard());
    } catch (error) {
      console.error("[bot] myid error", error);
      await ctx.reply(getApiErrorMessage(error, "Telegram ID ni tekshirib bo'lmadi."), mainKeyboard());
    }
  });

  bot.hears(COURIER_BUTTON_LABEL, handleCourierEntry);
  bot.hears(ONLINE_BUTTON_LABEL, async (ctx) => handleOnlineToggle(ctx, "online"));
  bot.hears(OFFLINE_BUTTON_LABEL, async (ctx) => handleOnlineToggle(ctx, "offline"));
  bot.hears(CANCEL_BUTTON_LABEL, async (ctx) => {
    clearOnboardingState(ctx.from?.id);
    await ctx.reply("Kuryer onboardingi bekor qilindi.", mainKeyboard());
  });

  bot.on(message("contact"), async (ctx) => {
    const state = getOnboardingState(ctx.from?.id);

    if (!state || state.step !== "phone") {
      return;
    }

    await handlePhoneCapture(ctx, ctx.message.contact.phone_number || "");
  });

  bot.on(message("text"), async (ctx) => {
    const text = ctx.message.text.trim();
    const state = getOnboardingState(ctx.from?.id);

    if (!state || text.startsWith("/") || RESERVED_TEXT_BUTTONS.has(text)) {
      return;
    }

    if (state.step === "phone") {
      await handlePhoneCapture(ctx, text);
      return;
    }

    if (state.step === "transport") {
      const selectedTransport = TRANSPORT_OPTIONS.find((option) => option.label === text);

      if (!selectedTransport) {
        await ctx.reply("Transport turini tugmalar orqali tanlang.", transportKeyboard());
        return;
      }

      await handleTransportSelection(ctx, selectedTransport.value);
    }
  });

  bot.catch((error) => {
    console.error("Bot xatoligi:", error);
  });

  return bot;
}

let runningBot = null;

export async function startBot() {
  const bot = createBot();

  await bot.telegram.setMyCommands([
    { command: "start", description: "Bot menyusini ochish" },
    { command: "menu", description: "Buyurtma tugmalarini ko'rsatish" },
    { command: "courier", description: "Kuryer onboardingini boshlash" },
    { command: "myid", description: "Telegram ID va courier status" }
  ]);

  await bot.launch();
  runningBot = bot;

  console.log(`Lazzat bot ishga tushdi. Mini App URL: ${normalizedMiniAppUrl}`);
  console.log(`Courier panel URL: ${courierMiniAppUrl}`);
  console.log(`Courier API URL: ${API_BASE_URL}`);

  return bot;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startBot().catch((error) => {
    console.error("Botni ishga tushirib bo'lmadi:", error);
    process.exit(1);
  });

  process.once("SIGINT", () => runningBot?.stop("SIGINT"));
  process.once("SIGTERM", () => runningBot?.stop("SIGTERM"));
}



