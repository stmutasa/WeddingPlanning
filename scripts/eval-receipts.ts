// Generates the four synthetic receipt images in docs/eval/receipts/ used by
// `npm run eval`. Synthetic on purpose: no real receipts are committed.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "docs/eval/receipts");
mkdirSync(out, { recursive: true });

function svg(width: number, height: number, bg: string, lines: { y: number; text: string; size?: number; weight?: number; family?: string; x?: number; color?: string }[]) {
  const body = lines
    .map(
      (l) =>
        `<text x="${l.x ?? 32}" y="${l.y}" font-size="${l.size ?? 22}" font-weight="${l.weight ?? 400}" font-family="${l.family ?? "sans-serif"}" fill="${l.color ?? "#111"}">${l.text.replace(/&/g, "&amp;")}</text>`,
    )
    .join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${bg}"/>${body}</svg>`);
}

async function write(name: string, buf: Buffer) {
  await sharp(buf).png().toFile(join(out, name));
  console.log("wrote", name);
}

async function main() {
await write(
  "mpesa-confirmation.png",
  svg(720, 520, "#f4f7f2", [
    { y: 60, text: "M-PESA", size: 34, weight: 700, color: "#2a7f3d" },
    { y: 120, text: "RJK4T7X2P1 Confirmed.", size: 24, weight: 700 },
    { y: 160, text: "Ksh24,000.00 sent to KAREN BLIXEN GARDENS LTD", size: 22 },
    { y: 196, text: "for account RURACIO-HOLD on 9/9/26 at 2:14 PM.", size: 22 },
    { y: 236, text: "New M-PESA balance is Ksh31,420.00.", size: 22 },
    { y: 276, text: "Transaction cost, Ksh105.00.", size: 22 },
    { y: 340, text: "Amount you can transact within the day is 476,000.00.", size: 18, color: "#555" },
  ]),
);

await write(
  "kes-invoice-instalments.png",
  svg(900, 1100, "#ffffff", [
    { y: 70, text: "TWO RIVERS CATERING CO.", size: 30, weight: 700 },
    { y: 104, text: "P.O. Box 4471, Nairobi · PIN P051234567Z", size: 18, color: "#555" },
    { y: 170, text: "INVOICE No. TRC-2026-0912", size: 24, weight: 700 },
    { y: 204, text: "Date: 12 September 2026", size: 20 },
    { y: 236, text: "Bill to: Annette Mugambi & Simukayi Mutasa", size: 20 },
    { y: 300, text: "Wedding reception catering — 180 guests @ KES 1,000", size: 20 },
    { y: 334, text: "Subtotal ................................ KES 180,000.00", size: 20, family: "monospace" },
    { y: 368, text: "VAT (inclusive)", size: 20 },
    { y: 420, text: "TOTAL DUE ................................ KES 180,000.00", size: 22, weight: 700, family: "monospace" },
    { y: 500, text: "Payment schedule", size: 24, weight: 700 },
    { y: 540, text: "1. Deposit 30%      KES 54,000    due 30 Sep 2026", size: 20, family: "monospace" },
    { y: 574, text: "2. Second 40%       KES 72,000    due 1 May 2027", size: 20, family: "monospace" },
    { y: 608, text: "3. Balance 30%      KES 54,000    due 1 Aug 2027", size: 20, family: "monospace" },
    { y: 700, text: "Cancellation: deposit non-refundable within 90 days of the event.", size: 18, color: "#555" },
    { y: 734, text: "Bank: KCB, Account 1234567890, Branch Kilimani. M-PESA Paybill 522522.", size: 18, color: "#555" },
  ]),
);

await write(
  "us-card-receipt.png",
  svg(520, 760, "#fbfbf8", [
    { y: 50, text: "PAPER & PRESS STUDIO", size: 24, weight: 700, family: "monospace", x: 24 },
    { y: 80, text: "118 Court St, Brooklyn NY", size: 16, family: "monospace", x: 24 },
    { y: 130, text: "09/06/2026  11:42 AM", size: 16, family: "monospace", x: 24 },
    { y: 180, text: "Save-the-date cards x150   240.00", size: 18, family: "monospace", x: 24 },
    { y: 210, text: "Envelopes, kraft x150       44.00", size: 18, family: "monospace", x: 24 },
    { y: 240, text: "Rush proof                   6.00", size: 18, family: "monospace", x: 24 },
    { y: 290, text: "SUBTOTAL                   290.00", size: 18, family: "monospace", x: 24 },
    { y: 320, text: "TAX 8.875%                  22.40", size: 18, family: "monospace", x: 24 },
    { y: 360, text: "TOTAL                      312.40", size: 22, weight: 700, family: "monospace", x: 24 },
    { y: 410, text: "VISA ****4417   APPROVED", size: 16, family: "monospace", x: 24 },
    { y: 470, text: "THANK YOU", size: 16, family: "monospace", x: 24 },
  ]),
);

await write(
  "handwritten-note.png",
  svg(700, 420, "#fff8dc", [
    { y: 80, text: "Mama Njeri - makeup trial", size: 34, family: "cursive" },
    { y: 150, text: "6,500 ksh cash", size: 34, family: "cursive" },
    { y: 220, text: "Sat 10 Oct", size: 30, family: "cursive" },
    { y: 300, text: "(pay balance on the day)", size: 26, family: "cursive", color: "#444" },
  ]),
);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
