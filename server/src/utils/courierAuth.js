import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { env } from "../config/env.js";
import { createAppError } from "./appError.js";

const COURIER_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const HASH_ALGORITHM = "scrypt";

function getCourierJwtSecret() {
  const configuredSecret = process.env.COURIER_JWT_SECRET || env.courierJwtSecret || "";

  if (configuredSecret) {
    return configuredSecret;
  }

  const fallbackSeed = process.env.SUPABASE_SERVICE_ROLE_KEY || env.supabaseServiceRoleKey || "";

  if (!fallbackSeed) {
    throw createAppError(503, "Courier auth hali sozlanmagan. COURIER_JWT_SECRET yoki SUPABASE_SERVICE_ROLE_KEY kerak.", {
      envFile: "server/.env",
      requiredVariables: ["COURIER_JWT_SECRET"],
      fallbackVariables: ["SUPABASE_SERVICE_ROLE_KEY"]
    });
  }

  return createHash("sha256").update(`courier-auth:${fallbackSeed}`).digest("hex");
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlEncodeJson(value) {
  return base64UrlEncode(JSON.stringify(value));
}

function base64UrlDecode(value) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  return Buffer.from(normalized, "base64").toString("utf8");
}

function signJwtParts(headerPart, payloadPart, secret) {
  return createHmac("sha256", secret)
    .update(`${headerPart}.${payloadPart}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function generateCourierTemporaryPassword() {
  return randomBytes(6)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase();
}

export function hashCourierPassword(password) {
  const normalizedPassword = String(password || "").trim();

  if (normalizedPassword.length < 6) {
    throw createAppError(400, "Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalizedPassword, salt, 64).toString("hex");
  return `${HASH_ALGORITHM}$${salt}$${hash}`;
}

export function verifyCourierPassword(password, passwordHash) {
  const normalizedPassword = String(password || "").trim();

  if (!passwordHash || !normalizedPassword) {
    return false;
  }

  const [algorithm, salt, storedHash] = passwordHash.split("$");

  if (algorithm !== HASH_ALGORITHM || !salt || !storedHash) {
    return false;
  }

  const computedHash = scryptSync(normalizedPassword, salt, 64).toString("hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  const computedBuffer = Buffer.from(computedHash, "hex");

  if (storedBuffer.length !== computedBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, computedBuffer);
}

export function signCourierAuthToken(payload) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    sub: payload.courierId,
    role: "courier",
    phone: payload.phone,
    iat: nowInSeconds,
    exp: nowInSeconds + COURIER_TOKEN_TTL_SECONDS
  };
  const headerPart = base64UrlEncodeJson({ alg: "HS256", typ: "JWT" });
  const payloadPart = base64UrlEncodeJson(tokenPayload);
  const signature = signJwtParts(headerPart, payloadPart, getCourierJwtSecret());

  return `${headerPart}.${payloadPart}.${signature}`;
}

export function verifyCourierAuthToken(token) {
  if (!token) {
    throw createAppError(401, "Courier token kiritilishi kerak.");
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    throw createAppError(401, "Courier token noto'g'ri formatda.");
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const secret = getCourierJwtSecret();
  const expectedSignature = signJwtParts(headerPart, payloadPart, secret);
  const providedBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw createAppError(401, "Courier token noto'g'ri yoki buzilgan.");
  }

  let payload;

  try {
    payload = JSON.parse(base64UrlDecode(payloadPart));
  } catch {
    throw createAppError(401, "Courier token o'qib bo'lmadi.");
  }

  const expiresAt = Number(payload.exp || 0);
  const issuedAt = Number(payload.iat || 0);

  if (!payload.sub || payload.role !== "courier" || !expiresAt || !issuedAt) {
    throw createAppError(401, "Courier token noto'g'ri payloadga ega.");
  }

  if (expiresAt <= Math.floor(Date.now() / 1000)) {
    throw createAppError(401, "Courier token muddati tugagan.");
  }

  return {
    courierId: String(payload.sub),
    phone: payload.phone || "",
    issuedAt,
    expiresAt,
    role: payload.role
  };
}

export function getCourierBearerToken(authorizationHeader = "") {
  const [scheme, token] = String(authorizationHeader).split(" ");

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

export function tryResolveCourierAuth(authorizationHeader = "") {
  const token = getCourierBearerToken(authorizationHeader);

  if (!token) {
    return null;
  }

  return verifyCourierAuthToken(token);
}
