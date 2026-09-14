import webpush from "web-push";

// `npm run vapid` — prints a fresh VAPID key pair to paste into .env as
// NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (DESIGN.md §9).
const keys = webpush.generateVAPIDKeys();

console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
