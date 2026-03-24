import { memo } from "react";

const CheckoutForm = memo(function CheckoutForm({ form, onFieldChange }) {
  console.count("CheckoutForm render");

  return (
    <>
      <section className="surface-card space-y-4">
        <div>
          <label htmlFor="customerName" className="mb-2 block text-sm font-bold text-lazzat-maroon">
            Ism
          </label>
          <input
            id="customerName"
            name="customerName"
            className="field-input"
            placeholder="Masalan, Azizbek"
            value={form.customerName}
            onChange={onFieldChange}
            required
          />
        </div>

        <div>
          <label htmlFor="phone" className="mb-2 block text-sm font-bold text-lazzat-maroon">
            Telefon
          </label>
          <input
            id="phone"
            name="phone"
            className="field-input"
            placeholder="+998 90 123 45 67"
            value={form.phone}
            onChange={onFieldChange}
            required
          />
        </div>
      </section>

      <section className="surface-card space-y-4">
        <div>
          <label htmlFor="address" className="mb-2 block text-sm font-bold text-lazzat-maroon">
            Yetkazib berish manzili
          </label>
          <textarea
            id="address"
            name="address"
            rows="3"
            className="field-input resize-none"
            placeholder="Mahalla, ko'cha, uy raqami va mo'ljal"
            value={form.address}
            onChange={onFieldChange}
            required
          />
        </div>
      </section>
    </>
  );
});

export default CheckoutForm;