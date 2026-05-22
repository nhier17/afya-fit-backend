export function generateReceiptNumber() {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);

    return `RCPT-${datePart}-${random}`;
}