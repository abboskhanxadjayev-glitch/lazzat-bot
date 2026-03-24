export async function notifyOperatorStatusChanged({ orderId, status, order }) {
  console.log("[operator-notifications] status update hook ready", {
    orderId,
    status,
    customerName: order?.customerName ?? null
  });

  return {
    queued: false,
    channel: "telegram_operator_placeholder"
  };
}