import { z } from "zod";

const phonePattern = /^[+]?[-()\d\s]{7,20}$/;

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

const telegramUserSchema = z.object({
  id: z.number().int().positive("Telegram user ID noto'g'ri."),
  username: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional()
});

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

export const registerCourierSchema = z.object({
  fullName: z.string().trim().min(2, "F.I.Sh. kamida 2 ta belgidan iborat bo'lishi kerak.").max(120).optional(),
  phone: z.string().trim().regex(phonePattern, "Telefon raqami noto'g'ri formatda."),
  telegramUser: telegramUserSchema
});

export const updateCourierStatusSchema = z.object({
  status: z.enum(COURIER_STATUS_VALUES, {
    errorMap: () => ({
      message: "Kuryer statusi noto'g'ri."
    })
  })
});
