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

const DEFAULT_MINI_APP_URL = "https://client-chi-nine-98.vercel.app";
const ORDER_BUTTON_LABEL = "\u{1F354} Buyurtma berish";
const COURIER_BUTTON_LABEL = "\u{1F69A} Kuryer bo'lish";
const OPEN_COURIER_PANEL_LABEL = "\u{1F69A} Courier panelni ochish";
const ONLINE_BUTTON_LABEL = "\u{1F7E2} Online bo'lish";
const OFFLINE_BUTTON_LABEL = "\u26AA Offline bo'lish";
const SHARE_CONTACT_LABEL = "\u{1F4F1} Telefonni ulashish";
const CANCEL_BUTTON_LABEL = "\u2B05 Bekor qilish";
const PHONE_PATTERN = /^[+]?[-()\d\s]{7,20}$/;
const UZBEK_PLATE_PATTERN = /^(?:\d{2}\s?[A-Z]\s?\d{3}\s?[A-Z]{2}|\d{2}\s?\d{3}\s?[A-Z]{3})$/i;
const RESERVED_TEXT_BUTTONS = new Set([
  COURIER_BUTTON_LABEL,
  ONLINE_BUTTON_LABEL,
  OFFLINE_BUTTON_LABEL,
  CANCEL_BUTTON_LABEL
]);
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

function resolveBotConfig(options = {}) {
  const token = options.token || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
  const miniAppUrl = options.miniAppUrl || process.env.MINI_APP_URL || DEFAULT_MINI_APP_URL;
  const normalizedMiniAppUrl = miniAppUrl.replace(/\/+$/, "");

  return {
    token,
    normalizedMiniAppUrl,
    courierMiniAppUrl: `${normalizedMiniAppUrl}/courier`
  };
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

function normalizeFreeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizePlateNumber(value) {
  return normalizeFreeText(value).toUpperCase();
}

function needsTransportDetails(transportType) {
  return ["bike", "moto", "car"].includes(transportType);
}

function needsPlateNumber(transportType) {
  return transportType === "car";
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

function getFreeTextKeyboard() {
  return Markup.keyboard([
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

function setOnboardingState(userId, nextState) {
  onboardingState.set(String(userId), nextState);
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

  if (needsTransportDetails(courier.transportType) && !courier.transportColor) {
    return "transport_color";
  }

  if (needsTransportDetails(courier.transportType) && !courier.vehicleBrand) {
    return "vehicle_brand";
  }

  if (needsPlateNumber(courier.transportType) && !courier.plateNumber) {
    return "plate_number";
  }

  if (courier.status === "approved") {
    return "approved";
  }

  return "pending";
}

function buildCourierSummary(courier) {
  const lines = [
    `ID: ${courier.telegramUserId}`,
    `Holat: ${formatCourierStatus(courier.status)}`,
    `Telefon: ${courier.phone || "Kiritilmagan"}`,
    `Transport: ${formatTransportType(courier.transportType)}`,
    `Online: ${formatOnlineStatus(courier.onlineStatus)}`
  ];

  if (courier.transportColor) {
    lines.push(`Rangi: ${courier.transportColor}`);
  }

  if (courier.vehicleBrand) {
    lines.push(`Brend/model: ${courier.vehicleBrand}`);
  }

  if (courier.plateNumber) {
    lines.push(`Davlat raqami: ${courier.plateNumber}`);
  }

  return lines.join("\n");
}

function getApiErrorMessage(error, fallbackMessage) {
  if (error?.details?.code === "COURIER_PROFILE_SCHEMA_NOT_READY") {
    return "Kuryer profil maydonlari hali tayyor emas. Iltimos, operator bilan bog'laning.";
  }

  if (error?.details?.code === "COURIER_VEHICLE_SCHEMA_NOT_READY") {
    return "Kuryer transport maydonlari hali tayyor emas. Iltimos, operator bilan bog'laning.";
  }

  if (error?.details?.code === "COURIER_BLOCKED") {
    return "Sizning kuryer profilingiz bloklangan. Operator bilan bog'laning.";
  }

  if (error?.details?.code === "COURIER_NOT_APPROVED") {
    return "Faqat tasdiqlangan kuryer online bo'la oladi.";
  }

  return error?.message || fallbackMessage;
}

function getHelpText() {
  return [
    "Lazzat Oshxonasi boti.",
    "",
    `• Buyurtma berish uchun: ${ORDER_BUTTON_LABEL}`,
    `• Kuryer onboardingi uchun: ${COURIER_BUTTON_LABEL}`,
    "• Telegram ID ni ko'rish uchun: /myid"
  ].join("\n");
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

async function finalizeCourierOnboarding(ctx, courier, profilePayload, config) {
  const updatedCourier = await updateCourierProfile(courier.id, {
    ...profilePayload,
    submitForApproval: true
  });

  clearOnboardingState(ctx.from?.id);
  await ctx.reply(
    `Ro'yxatdan o'tish yakunlandi. Admin tasdiqlashi kerak.\n\n${buildCourierSummary(updatedCourier)}`,
    getCourierPanelKeyboard(updatedCourier, config)
  );
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
    setOnboardingState(userId, { step: "phone", courierId: courier.id });
    await ctx.reply(
      `${messagePrefix}Kuryer bo'lib ro'yxatdan o'tish uchun telefon raqamingizni yuboring yoki tugma orqali ulashing.`,
      getPhoneKeyboard()
    );
    return;
  }

  if (step === "transport") {
    setOnboardingState(userId, { step: "transport", courierId: courier.id });
    await ctx.reply(`${messagePrefix}Transport turini tanlang.`, getTransportKeyboard());
    return;
  }

  if (step === "transport_color") {
    setOnboardingState(userId, {
      step: "transport_color",
      courierId: courier.id,
      transportType: courier.transportType
    });
    await ctx.reply(`${messagePrefix}Transport rangini yozing. Masalan: qora, oq, ko'k.`, getFreeTextKeyboard());
    return;
  }

  if (step === "vehicle_brand") {
    setOnboardingState(userId, {
      step: "vehicle_brand",
      courierId: courier.id,
      transportType: courier.transportType,
      transportColor: courier.transportColor || null
    });
    await ctx.reply(`${messagePrefix}Transport brendi yoki modelini yozing.`, getFreeTextKeyboard());
    return;
  }

  if (step === "plate_number") {
    setOnboardingState(userId, {
      step: "plate_number",
      courierId: courier.id,
      transportType: courier.transportType,
      transportColor: courier.transportColor || null,
      vehicleBrand: courier.vehicleBrand || null
    });
    await ctx.reply(`${messagePrefix}Avtomobil davlat raqamini yozing. Masalan: 01 A 123 BC`, getFreeTextKeyboard());
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
    console.error("[bot] courier entry error", error);
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

  const normalizedPhone = normalizeFreeText(phoneNumber);

  if (!PHONE_PATTERN.test(normalizedPhone)) {
    await ctx.reply("Telefon raqamini to'g'ri formatda yuboring. Masalan: +998 90 123 45 67", getPhoneKeyboard());
    return;
  }

  try {
    const updatedCourier = await updateCourierProfile(courier.id, {
      phone: normalizedPhone
    });
    setOnboardingState(userId, { step: "transport", courierId: updatedCourier.id });
    await ctx.reply("Rahmat. Endi transport turini tanlang.", getTransportKeyboard());
  } catch (error) {
    console.error("[bot] phone capture error", error);
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
    if (transportType === "foot") {
      await finalizeCourierOnboarding(ctx, courier, {
        transportType,
        transportColor: null,
        vehicleBrand: null,
        plateNumber: null
      }, config);
      return;
    }

    setOnboardingState(userId, {
      step: "transport_color",
      courierId: courier.id,
      transportType
    });
    await ctx.reply("Transport rangini yozing. Masalan: qora, oq, ko'k.", getFreeTextKeyboard());
  } catch (error) {
    console.error("[bot] transport selection error", error);
    await ctx.reply(getApiErrorMessage(error, "Transport turini saqlab bo'lmadi."), getMainKeyboard(config));
  }
}

async function handleTransportColorInput(ctx, transportColor, config) {
  const userId = ctx.from?.id;
  const state = getOnboardingState(userId);

  if (!userId || !state?.transportType) {
    return;
  }

  const normalizedTransportColor = normalizeFreeText(transportColor);

  if (normalizedTransportColor.length < 2) {
    await ctx.reply("Transport rangini aniqroq yozing. Masalan: qora, oq, ko'k.", getFreeTextKeyboard());
    return;
  }

  setOnboardingState(userId, {
    ...state,
    step: "vehicle_brand",
    transportColor: normalizedTransportColor
  });
  await ctx.reply("Transport brendi yoki modelini yozing.", getFreeTextKeyboard());
}

async function handleVehicleBrandInput(ctx, vehicleBrand, config) {
  const userId = ctx.from?.id;
  const state = getOnboardingState(userId);

  if (!userId || !state?.transportType || !state?.transportColor) {
    return;
  }

  const normalizedVehicleBrand = normalizeFreeText(vehicleBrand);

  if (normalizedVehicleBrand.length < 2) {
    await ctx.reply("Transport brendi yoki modelini to'liqroq yozing.", getFreeTextKeyboard());
    return;
  }

  let courier = await loadCourierProfile(ctx);

  if (!courier) {
    courier = await getOrCreateCourier(ctx);
  }

  if (needsPlateNumber(state.transportType)) {
    setOnboardingState(userId, {
      ...state,
      step: "plate_number",
      vehicleBrand: normalizedVehicleBrand
    });
    await ctx.reply("Avtomobil davlat raqamini yozing. Masalan: 01 A 123 BC", getFreeTextKeyboard());
    return;
  }

  try {
    await finalizeCourierOnboarding(ctx, courier, {
      transportType: state.transportType,
      transportColor: state.transportColor,
      vehicleBrand: normalizedVehicleBrand,
      plateNumber: null
    }, config);
  } catch (error) {
    console.error("[bot] vehicle brand error", error);
    await ctx.reply(getApiErrorMessage(error, "Transport ma'lumotlarini saqlab bo'lmadi."), getMainKeyboard(config));
  }
}

async function handlePlateNumberInput(ctx, plateNumber, config) {
  const userId = ctx.from?.id;
  const state = getOnboardingState(userId);

  if (!userId || !state?.transportType || !state?.transportColor || !state?.vehicleBrand) {
    return;
  }

  const normalizedPlateNumber = normalizePlateNumber(plateNumber);

  if (!UZBEK_PLATE_PATTERN.test(normalizedPlateNumber)) {
    await ctx.reply("Davlat raqami noto'g'ri. Masalan: 01 A 123 BC", getFreeTextKeyboard());
    return;
  }

  let courier = await loadCourierProfile(ctx);

  if (!courier) {
    courier = await getOrCreateCourier(ctx);
  }

  try {
    await finalizeCourierOnboarding(ctx, courier, {
      transportType: state.transportType,
      transportColor: state.transportColor,
      vehicleBrand: state.vehicleBrand,
      plateNumber: normalizedPlateNumber
    }, config);
  } catch (error) {
    console.error("[bot] plate number error", error);
    await ctx.reply(getApiErrorMessage(error, "Avtomobil ma'lumotlarini saqlab bo'lmadi."), getMainKeyboard(config));
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
    console.error("[bot] online toggle error", error);
    await ctx.reply(getApiErrorMessage(error, "Online holatini yangilab bo'lmadi."), getMainKeyboard(config));
  }
}

export async function syncBotConfiguration(bot) {
  const config = bot.__lazzatConfig || resolveBotConfig();

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

export function createBot(options = {}) {
  const config = resolveBotConfig(options);

  if (!config.token) {
    throw new Error("BOT_TOKEN yoki TELEGRAM_BOT_TOKEN topilmadi.");
  }

  const bot = new Telegraf(config.token);
  bot.__lazzatConfig = config;

  bot.start(async (ctx) => {
    clearOnboardingState(ctx.from?.id);
    await ctx.reply(
      "Lazzat Oshxonasi botiga xush kelibsiz. Buyurtma berish yoki kuryer sifatida ro'yxatdan o'tish uchun quyidagi tugmalardan foydalaning.",
      getMainKeyboard(config)
    );
  });

  bot.command("menu", async (ctx) => {
    await ctx.reply("Buyurtma berish yoki kuryer onboardingini boshlash uchun quyidagi tugmalardan foydalaning.", getMainKeyboard(config));
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
      console.error("[bot] myid error", error);
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
      return;
    }

    if (state.step === "transport_color") {
      await handleTransportColorInput(ctx, text, config);
      return;
    }

    if (state.step === "vehicle_brand") {
      await handleVehicleBrandInput(ctx, text, config);
      return;
    }

    if (state.step === "plate_number") {
      await handlePlateNumberInput(ctx, text, config);
    }
  });

  bot.catch((error) => {
    console.error("Bot xatoligi:", error);
  });

  return bot;
}

let runningBot = null;

export async function startBot(options = {}) {
  const bot = createBot(options);
  await syncBotConfiguration(bot);
  await bot.launch();
  runningBot = bot;

  const config = bot.__lazzatConfig;
  console.log(`Lazzat bot ishga tushdi. Mini App URL: ${config.normalizedMiniAppUrl}`);
  console.log(`Courier panel URL: ${config.courierMiniAppUrl}`);
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
