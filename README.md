# Lazzat Oshxonasi Mini App Starter

Telegram Mini App starter for a food ordering service called **Lazzat Oshxonasi**.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: Supabase Postgres
- Bot: Telegram bot with `web_app` launch button

## Project Structure

```text
.
|-- client   # Telegram Mini App frontend
|-- server   # Express REST API
|-- bot      # Telegram bot
```

## MVP Features

- Display food categories
- Display products by category
- Add and remove items in cart
- Show running total price
- Checkout form for name, phone, and address
- Send order to backend API
- Validate and store orders
- Open Mini App from Telegram bot

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment files

Copy these files and fill in real values:

- `client/.env.example` -> `client/.env`
- `server/.env.example` -> `server/.env`
- `bot/.env.example` -> `bot/.env`

### 3. Prepare Supabase

Run the SQL in [server/supabase/schema.sql](/C:/lazzat%20bot/server/supabase/schema.sql) inside the Supabase SQL editor.

Required server environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If Supabase is not configured yet, the API still serves mock categories/products and stores orders in memory as a fallback starter mode.

### 4. Run the project

```bash
npm run dev
```

This starts:

- Vite client on `http://localhost:5173`
- Express server on `http://localhost:5000`
- Telegram bot in watch mode

## API Endpoints

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products?categorySlug=osh`
- `POST /api/orders`
- `GET /api/orders`

### Example order payload

```json
{
  "customerName": "Azizbek",
  "phone": "+998 90 123 45 67",
  "address": "Yunusobod, 12-kvartal",
  "notes": "Qo'shimcha achchiq qilib bering",
  "items": [
    {
      "productId": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      "quantity": 2
    }
  ]
}
```

## Telegram Bot Notes

- Set `MINI_APP_URL` to your deployed frontend URL.
- For production Telegram Mini Apps, use HTTPS.
- During local development, use a tunnel service if you want to test from a real Telegram client.

## Design Notes

The client is mobile-first and uses a red, dark red, and gold palette to match the Lazzat brand direction.
