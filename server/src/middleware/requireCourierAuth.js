import { createAppError } from "../utils/appError.js";
import { tryResolveCourierAuth } from "../utils/courierAuth.js";

export function requireCourierAuth(req, _res, next) {
  try {
    const courierAuth = tryResolveCourierAuth(req.headers.authorization || "");

    if (!courierAuth) {
      throw createAppError(401, "Courier token kiritilishi kerak.");
    }

    req.courierAuth = courierAuth;
    next();
  } catch (error) {
    next(error);
  }
}

export function attachOptionalCourierAuth(req, _res, next) {
  try {
    const courierAuth = tryResolveCourierAuth(req.headers.authorization || "");
    req.courierAuth = courierAuth || null;
    next();
  } catch (error) {
    next(error);
  }
}
