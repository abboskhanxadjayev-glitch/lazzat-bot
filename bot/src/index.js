import "dotenv/config";
import { Markup, Telegraf } from "telegraf";

const token = process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL || "http://localhost:5173";

if (!token) {
  console.error("BOT_TOKEN topilmadi. bot/.env faylini to'ldiring.");
  process.exit(1);
}

const bot = new Telegraf(token);

function miniAppKeyboard() {
  return Markup.keyboard([
    [Markup.button.webApp("Mini Appni ochish", miniAppUrl)]
  ]).resize();
}

bot.start(async (ctx) => {
  await ctx.reply(
    "Lazzat Oshxonasi botiga xush kelibsiz. Mini Appni ochib, milliy taomlarni bir necha bosishda buyurtma qiling.",
    miniAppKeyboard()
  );
});

bot.command("menu", async (ctx) => {
  await ctx.reply(
    "Buyurtma berish uchun quyidagi tugmani bosing.",
    miniAppKeyboard()
  );
});

bot.catch((error) => {
  console.error("Bot xatoligi:", error);
});

async function startBot() {
  await bot.telegram.setMyCommands([
    { command: "start", description: "Mini Appni ishga tushirish" },
    { command: "menu", description: "Mini App tugmasini ko'rsatish" }
  ]);

  await bot.launch();
  console.log(`Lazzat bot ishga tushdi. Mini App URL: ${miniAppUrl}`);
}

startBot().catch((error) => {
  console.error("Botni ishga tushirib bo'lmadi:", error);
  process.exit(1);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
