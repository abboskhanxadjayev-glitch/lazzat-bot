import { z } from "zod";

const phonePattern = /^[+]?[-()\d\s]{7,20}$/;
const uzbekPlatePattern = /^(?:\d{2}\s?[A-Z]\s?\d{3}\s?[A-Z]{2}|\d{2}\s?\d{3}\s?[A-Z]{3})$/i;

function normalizePlateNumber(value) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export const ORDER_STATUS_VALUES = [
  "pending",
  "accepted",
  "preparing",
  "ready_for_delivery",
  "on_the_way",
  "delivered",
  "cancelled"
];

export const COURIER_STATUS_VALUES = ["pending", "approved", "blocked"];
export const COURIER_TRANSPORT_VALUES = ["foot", "bike", "moto", "car"];
export const COURIER_ONLINE_STATUS_VALUES = ["offline", "online"];

const telegramUserSchema = z.object({
  id: z.number().int().positive("Telegram user ID noto'g'ri."),
  username: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional()
});

const optionalTrimmedText = (maxLength, label) => z
  .string()
  .trim()
  .min(2, `${label} kamida 2 ta belgidan iborat bo'lishi kerak.`)
  .max(maxLength)
  .nullable()
  .optional();

const plateNumberSchema = z
  .string()
  .trim()
  .min(5, "Avtomobil raqami juda qisqa.")
  .max(20, "Avtomobil raqami juda uzun.")
  .transform(normalizePlateNumber)
  .refine((value) => uzbekPlatePattern.test(value), {
    message: "Avtomobil raqami noto'g'ri formatda. Masalan: 01 A 123 BC"
  })
  .nullable()
  .optional();

export const createOrderSchema = z
  .object({
    customerName: z.string().trim().min(2, "Ism kamida 2 ta harf bo'lishi kerak.").max(80),
    phone: z.string().trim().regex(phonePattern, "Telefon raqami noto'g'ri formatda."),
    address: z.string().trim().min(5, "Manzil juda qisqa.").max(200),
    notes: z.string().trim().max(300).optional(),
    customerLat: z.number().min(-90, "Latitude noto'g'ri.").max(90, "Latitude noto'g'ri.").optional(),
    customerLng: z.number().min(-180, "Longitude noto'g'ri.").max(180, "Longitude noto'g'ri.").optional(),
    deliveryDistanceKm: z.number().nonnegative().optional(),
    deliveryFee: z.number().nonnegative().optional(),
    totalAmount: z.number().nonnegative().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1, "Mahsulot ID kiritilishi kerak."),
          quantity: z.number().int().positive().max(20)
        })
      )
      .min(1, "Kamida bitta mahsulot bo'lishi kerak."),
    telegramUser: telegramUserSchema.nullable().optional()
  })
  .superRefine((payload, context) => {
    const hasCustomerLat = typeof payload.customerLat === "number";
    const hasCustomerLng = typeof payload.customerLng === "number";

    if (hasCustomerLat !== hasCustomerLng) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasCustomerLat ? ["customerLng"] : ["customerLat"],
        message: "Latitude va longitude birgalikda yuborilishi kerak."
      });
    }
  });

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES, {
    errorMap: () => ({
      message: "Status noto'g'ri. Ruxsat etilgan statuslardan birini tanlang."
    })
  })
});

export const assignCourierSchema = z.object({
  courierId: z.string().uuid("Kuryer ID noto'g'ri.").nullable().optional()
});

export const ensureCourierSchema = z.object({
  telegramUser: telegramUserSchema
});

export const registerCourierSchema = z.object({
  fullName: z.string().trim().min(2, "F.I.Sh. kamida 2 ta belgidan iborat bo'lishi kerak.").max(120).optional(),
  phone: z.string().trim().regex(phonePattern, "Telefon raqami noto'g'ri formatda."),
  transportType: z.enum(COURIER_TRANSPORT_VALUES).optional(),
  transportColor: optionalTrimmedText(60, "Transport rangi"),
  vehicleBrand: optionalTrimmedText(80, "Transport brendi"),
  plateNumber: plateNumberSchema,
  telegramUser: telegramUserSchema
});

export const courierLoginSchema = z.object({
  phone: z.string().trim().regex(phonePattern, "Telefon raqami noto'g'ri formatda."),
  password: z.string().trim().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak.").max(128)
});

export const setCourierPasswordSchema = z.object({
  password: z.string().trim().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak.").max(128)
});

export const updateCourierProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, "F.I.Sh. kamida 2 ta belgidan iborat bo'lishi kerak.").max(120).optional(),
    phone: z.string().trim().regex(phonePattern, "Telefon raqami noto'g'ri formatda.").optional(),
    transportType: z.enum(COURIER_TRANSPORT_VALUES, {
      errorMap: () => ({ message: "Transport turi noto'g'ri." })
    }).optional(),
    transportColor: optionalTrimmedText(60, "Transport rangi"),
    vehicleBrand: optionalTrimmedText(80, "Transport brendi"),
    plateNumber: plateNumberSchema,
    submitForApproval: z.boolean().optional()
  })
  .superRefine((payload, context) => {
    const hasAnyValue = Object.values(payload).some((value) => value !== undefined);

    if (!hasAnyValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Kamida bitta courier profile maydoni yuborilishi kerak."
      });
    }
  });

export const updateCourierStatusSchema = z.object({
  status: z.enum(COURIER_STATUS_VALUES, {
    errorMap: () => ({
      message: "Kuryer statusi noto'g'ri."
    })
  })
});

export const updateCourierOnlineStatusSchema = z.object({
  onlineStatus: z.enum(COURIER_ONLINE_STATUS_VALUES, {
    errorMap: () => ({
      message: "Online holat noto'g'ri."
    })
  })
});
