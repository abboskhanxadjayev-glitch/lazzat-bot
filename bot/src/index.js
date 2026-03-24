import "dotenv/config";
import { Markup, Telegraf } from "telegraf";

const token = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL || "http://localhost:5173";
const normalizedMiniAppUrl = miniAppUrl.replace(/\/+$/, "");
const courierMiniAppUrl = `${normalizedMiniAppUrl}/courier`;

if (!token) {
  console.error("BOT_TOKEN topilmadi. bot/.env faylini to'ldiring.");
  process.exit(1);
}

const bot = new Telegraf(token);

function mainKeyboard() {
  return Markup.keyboard([
    [Markup.button.webApp("Mini Appni ochish", normalizedMiniAppUrl)],
    [Markup.button.webApp("Kuryer paneli", courierMiniAppUrl)]
  ]).resize();
}

bot.start(async (ctx) => {
  await ctx.reply(
    "Lazzat Oshxonasi botiga xush kelibsiz. Buyurtma berish yoki kuryer panelini ochish uchun quyidagi tugmalardan foydalaning.",
    mainKeyboard()
  );
});

bot.command("menu", async (ctx) => {
  await ctx.reply(
    "Buyurtma berish uchun quyidagi tugmani bosing.",
    mainKeyboard()
  );
});

bot.command("courier", async (ctx) => {
  await ctx.reply(
    "Kuryer sifatida ro'yxatdan o'tish yoki biriktirilgan yetkazmalarni ko'rish uchun quyidagi tugmani bosing.",
    Markup.keyboard([[Markup.button.webApp("Kuryer panelini ochish", courierMiniAppUrl)]]).resize()
  );
});

bot.catch((error) => {
  console.error("Bot xatoligi:", error);
});

async function startBot() {
  await bot.telegram.setMyCommands([
    { command: "start", description: "Mini Appni ishga tushirish" },
    { command: "menu", description: "Buyurtma tugmalarini ko'rsatish" },
    { command: "courier", description: "Kuryer panelini ochish" }
  ]);

  await bot.launch();
  console.log(`Lazzat bot ishga tushdi. Mini App URL: ${normalizedMiniAppUrl}`);
  console.log(`Courier panel URL: ${courierMiniAppUrl}`);
}

startBot().catch((error) => {
  console.error("Botni ishga tushirib bo'lmadi:", error);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
