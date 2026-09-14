import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const CLEAR = process.argv.includes("--clear");
const DEMO = process.argv.includes("--demo");

// Keep this in sync with the EMAIL_PROFILE map in auth.ts.
const USERS = [
  { email: "annettemugambi@gmail.com", displayName: "Annette", hue: "pink" as const },
  { email: "stmutasa@gmail.com", displayName: "Simi", hue: "blue" as const },
];

// DESIGN.md §1: envelopes sum to the $50,000 total, unallocated $0.
const EVENTS = [
  { slug: "ruracio", name: "Ruracio", budgetCents: 800_000, sortOrder: 0, locked: false },
  { slug: "wedding", name: "Wedding", budgetCents: 3_200_000, sortOrder: 1, locked: false },
  { slug: "honeymoon", name: "Honeymoon", budgetCents: 700_000, sortOrder: 2, locked: false },
  { slug: "party", name: "Joint bachelor / bachelorette", budgetCents: 300_000, sortOrder: 3, locked: false },
  { slug: "general", name: "General", budgetCents: 0, sortOrder: 4, locked: true },
];

// DESIGN.md §3 Category comment, verbatim, 14 categories.
const CATEGORIES = [
  "Venue",
  "Catering",
  "Attire",
  "Photo & Video",
  "Music & DJ",
  "Decor & Flowers",
  "Stationery",
  "Beauty",
  "Transport",
  "Travel & Stay",
  "Gifts & Favours",
  "Fees & Legal",
  "Ruracio gifts",
  "Other",
];

async function clearAll() {
  console.log("Clearing all data...");
  // Children before parents.
  await db.chatMessage.deleteMany();
  await db.chatThread.deleteMany();
  await db.aiUsage.deleteMany();
  await db.modelCache.deleteMany();
  await db.briefSnapshot.deleteMany();
  await db.activity.deleteMany();
  await db.pushSubscription.deleteMany();
  await db.attachment.deleteMany();
  await db.transaction.deleteMany();
  await db.plaidAccount.deleteMany();
  await db.plaidItem.deleteMany();
  await db.guestEvent.deleteMany();
  await db.guest.deleteMany();
  await db.note.deleteMany();
  await db.task.deleteMany();
  await db.settlement.deleteMany();
  await db.contribution.deleteMany();
  await db.expense.deleteMany();
  await db.paymentDue.deleteMany();
  await db.vendor.deleteMany();
  await db.budgetLine.deleteMany();
  await db.funder.deleteMany();
  await db.category.deleteMany();
  await db.event.deleteMany();
  await db.userSettings.deleteMany();
  await db.appSettings.deleteMany();
  await db.wedding.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();
  console.log("Cleared.");
}

async function seedUsers() {
  const created: Record<string, { id: string; funderId: string }> = {};
  for (const u of USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.displayName },
    });
    await db.userSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, displayName: u.displayName, hue: u.hue },
    });
    const funder = await db.funder.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, name: u.displayName, kind: "USER" },
    });
    created[u.displayName.toLowerCase()] = { id: user.id, funderId: funder.id };
  }
  return created;
}

async function seedBase() {
  await db.wedding.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });

  const briefToken = randomBytes(16).toString("hex");
  await db.appSettings.upsert({
    where: { id: "main" },
    update: {},
    create: { id: "main", briefToken },
  });

  for (const e of EVENTS) {
    await db.event.upsert({
      where: { slug: e.slug },
      update: {},
      create: e,
    });
  }

  for (const [i, name] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { name },
      update: {},
      create: { name, sortOrder: i },
    });
  }

  const users = await seedUsers();

  const joint = await db.funder.findFirst({ where: { kind: "JOINT" } });
  if (!joint) {
    await db.funder.create({ data: { name: "Joint", kind: "JOINT" } });
  }

  return users;
}

async function seedDemo(users: Record<string, { id: string; funderId: string }>) {
  const events = await db.event.findMany();
  const categories = await db.category.findMany();
  const joint = await db.funder.findFirstOrThrow({ where: { kind: "JOINT" } });

  const eventBySlug = Object.fromEntries(events.map((e) => [e.slug, e]));
  const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]));
  const annette = users.annette;
  const simi = users.simi;

  const existingExpenses = await db.expense.count();
  if (existingExpenses === 0) {
    console.log("Seeding demo expenses...");
    const KES_RATE = 0.0077; // 1 KES ~ $0.0077, example rate used only for seed data
    type DemoExpense = {
      description: string;
      amountCents: number;
      originalAmount?: number;
      originalCurrency?: string;
      fxRate?: number;
      daysAgo: number;
      eventSlug: string;
      categoryName: string;
      funderId: string;
      source: string;
    };
    const demo: DemoExpense[] = [
      { description: "Venue site visit deposit", amountCents: 80000, daysAgo: 60, eventSlug: "wedding", categoryName: "Venue", funderId: joint.id, source: "MANUAL" },
      { description: "Ruracio family gift", amountCents: fx(15000, KES_RATE), originalAmount: 15000, originalCurrency: "KES", fxRate: KES_RATE, daysAgo: 55, eventSlug: "ruracio", categoryName: "Ruracio gifts", funderId: simi.funderId, source: "QUICK_ADD" },
      { description: "Engagement photographer half", amountCents: 60000, daysAgo: 50, eventSlug: "wedding", categoryName: "Photo & Video", funderId: annette.funderId, source: "MANUAL" },
      { description: "Save-the-dates printing", amountCents: 24000, daysAgo: 48, eventSlug: "general", categoryName: "Stationery", funderId: joint.id, source: "MANUAL" },
      { description: "Caterer tasting fee", amountCents: 15000, daysAgo: 45, eventSlug: "wedding", categoryName: "Catering", funderId: joint.id, source: "MANUAL" },
      { description: "DJ deposit", amountCents: 30000, daysAgo: 42, eventSlug: "wedding", categoryName: "Music & DJ", funderId: simi.funderId, source: "MANUAL" },
      { description: "Bridal party gift shopping", amountCents: fx(8000, KES_RATE), originalAmount: 8000, originalCurrency: "KES", fxRate: KES_RATE, daysAgo: 40, eventSlug: "wedding", categoryName: "Gifts & Favours", funderId: annette.funderId, source: "RECEIPT" },
      { description: "Suit fitting", amountCents: 45000, daysAgo: 38, eventSlug: "wedding", categoryName: "Attire", funderId: simi.funderId, source: "MANUAL" },
      { description: "Dress alteration deposit", amountCents: 35000, daysAgo: 36, eventSlug: "wedding", categoryName: "Attire", funderId: annette.funderId, source: "MANUAL" },
      { description: "Honeymoon flights deposit", amountCents: 120000, daysAgo: 34, eventSlug: "honeymoon", categoryName: "Travel & Stay", funderId: joint.id, source: "MANUAL" },
      { description: "Marriage notice fee", amountCents: 5000, daysAgo: 32, eventSlug: "general", categoryName: "Fees & Legal", funderId: simi.funderId, source: "MANUAL" },
      { description: "Florist consultation", amountCents: 10000, daysAgo: 30, eventSlug: "wedding", categoryName: "Decor & Flowers", funderId: annette.funderId, source: "MANUAL" },
      { description: "Bachelor/bachelorette venue hold", amountCents: 50000, daysAgo: 28, eventSlug: "party", categoryName: "Venue", funderId: joint.id, source: "MANUAL" },
      { description: "Hair and makeup trial", amountCents: 18000, daysAgo: 26, eventSlug: "wedding", categoryName: "Beauty", funderId: annette.funderId, source: "MANUAL" },
      { description: "Ruracio transport for elders", amountCents: fx(20000, KES_RATE), originalAmount: 20000, originalCurrency: "KES", fxRate: KES_RATE, daysAgo: 24, eventSlug: "ruracio", categoryName: "Transport", funderId: joint.id, source: "MANUAL" },
      { description: "Wedding invitations", amountCents: 32000, daysAgo: 20, eventSlug: "general", categoryName: "Stationery", funderId: simi.funderId, source: "MANUAL" },
      { description: "Honeymoon resort deposit", amountCents: 90000, daysAgo: 18, eventSlug: "honeymoon", categoryName: "Travel & Stay", funderId: joint.id, source: "MANUAL" },
      { description: "Videographer deposit", amountCents: 70000, daysAgo: 14, eventSlug: "wedding", categoryName: "Photo & Video", funderId: annette.funderId, source: "MANUAL" },
      { description: "Ruracio ceremony catering", amountCents: fx(35000, KES_RATE), originalAmount: 35000, originalCurrency: "KES", fxRate: KES_RATE, daysAgo: 10, eventSlug: "ruracio", categoryName: "Catering", funderId: joint.id, source: "MANUAL" },
      { description: "Party favours", amountCents: 12000, daysAgo: 5, eventSlug: "party", categoryName: "Gifts & Favours", funderId: simi.funderId, source: "MANUAL" },
    ];

    for (const e of demo) {
      await db.expense.create({
        data: {
          description: e.description,
          amountCents: e.amountCents,
          originalAmount: e.originalAmount ?? null,
          originalCurrency: e.originalCurrency ?? null,
          fxRate: e.fxRate ?? null,
          date: daysAgo(e.daysAgo),
          eventId: eventBySlug[e.eventSlug].id,
          categoryId: categoryByName[e.categoryName]?.id ?? null,
          funderId: e.funderId,
          source: e.source,
          createdById: e.funderId === joint.id ? simi.id : e.funderId === annette.funderId ? annette.id : simi.id,
        },
      });
    }
  }

  const existingVendors = await db.vendor.count();
  if (existingVendors === 0) {
    console.log("Seeding demo vendors + payment schedules...");
    const vendors: {
      name: string;
      categoryName: string;
      eventSlug: string;
      status: string;
      quotedCents: number;
      schedule: { label: string; amountCents: number; daysFromNow: number }[];
    }[] = [
      {
        name: "Ridgeview Gardens",
        categoryName: "Venue",
        eventSlug: "wedding",
        status: "BOOKED",
        quotedCents: 1_200_000,
        schedule: [
          { label: "Deposit", amountCents: 400_000, daysFromNow: -30 },
          { label: "Balance", amountCents: 800_000, daysFromNow: 90 },
        ],
      },
      {
        name: "Nairobi Bloom Florists",
        categoryName: "Decor & Flowers",
        eventSlug: "wedding",
        status: "QUOTED",
        quotedCents: 250_000,
        schedule: [{ label: "Deposit", amountCents: 80_000, daysFromNow: 21 }],
      },
      {
        name: "Savannah Lens Studio",
        categoryName: "Photo & Video",
        eventSlug: "wedding",
        status: "BOOKED",
        quotedCents: 350_000,
        schedule: [
          { label: "Deposit", amountCents: 70_000, daysFromNow: -14 },
          { label: "Balance", amountCents: 280_000, daysFromNow: 120 },
        ],
      },
      {
        name: "Two Rivers Catering Co.",
        categoryName: "Catering",
        eventSlug: "wedding",
        status: "QUOTED",
        quotedCents: 900_000,
        schedule: [{ label: "Deposit", amountCents: 150_000, daysFromNow: 10 }],
      },
      {
        name: "DJ Kaz",
        categoryName: "Music & DJ",
        eventSlug: "wedding",
        status: "BOOKED",
        quotedCents: 180_000,
        schedule: [{ label: "Balance", amountCents: 150_000, daysFromNow: 100 }],
      },
      {
        name: "Amani Beauty Bar",
        categoryName: "Beauty",
        eventSlug: "wedding",
        status: "CONSIDERING",
        quotedCents: 60_000,
        schedule: [],
      },
    ];

    for (const v of vendors) {
      const vendor = await db.vendor.create({
        data: {
          name: v.name,
          categoryId: categoryByName[v.categoryName]?.id ?? null,
          eventId: eventBySlug[v.eventSlug]?.id ?? null,
          status: v.status,
          quotedCents: v.quotedCents,
        },
      });
      for (const s of v.schedule) {
        await db.paymentDue.create({
          data: {
            vendorId: vendor.id,
            label: s.label,
            amountCents: s.amountCents,
            dueDate: daysFromNow(s.daysFromNow),
            status: s.daysFromNow < 0 ? "PAID" : "OPEN",
          },
        });
      }
    }
  }

  const existingTasks = await db.task.count();
  if (existingTasks === 0) {
    console.log("Seeding demo tasks...");
    const tasks: { title: string; eventSlug: string | null; daysFromNow: number; priority: "P1" | "P2" | "P3"; milestone?: boolean; assigneeId?: string }[] = [
      { title: "Set the wedding date", eventSlug: "wedding", daysFromNow: 7, priority: "P1", milestone: true },
      { title: "Confirm Ruracio delegation with elders", eventSlug: "ruracio", daysFromNow: 14, priority: "P1" },
      { title: "Book the venue", eventSlug: "wedding", daysFromNow: 21, priority: "P1", milestone: true, assigneeId: simi.id },
      { title: "Apply for marriage notice", eventSlug: "general", daysFromNow: 30, priority: "P1" },
      { title: "Shortlist caterers", eventSlug: "wedding", daysFromNow: 35, priority: "P2", assigneeId: annette.id },
      { title: "Book photographer", eventSlug: "wedding", daysFromNow: 40, priority: "P2" },
      { title: "Start guest list", eventSlug: "wedding", daysFromNow: 45, priority: "P2", assigneeId: annette.id },
      { title: "Book honeymoon flights", eventSlug: "honeymoon", daysFromNow: 60, priority: "P2" },
      { title: "Order invitations", eventSlug: "general", daysFromNow: 90, priority: "P2" },
      { title: "Book hair and makeup trial", eventSlug: "wedding", daysFromNow: 120, priority: "P3", assigneeId: annette.id },
      { title: "Plan the joint bachelor/bachelorette party", eventSlug: "party", daysFromNow: 150, priority: "P3" },
      { title: "Final vendor payments", eventSlug: "wedding", daysFromNow: 200, priority: "P1", milestone: true },
    ];
    for (const [i, t] of tasks.entries()) {
      await db.task.create({
        data: {
          title: t.title,
          eventId: t.eventSlug ? eventBySlug[t.eventSlug]?.id ?? null : null,
          dueDate: daysFromNow(t.daysFromNow),
          priority: t.priority,
          milestone: Boolean(t.milestone),
          assigneeId: t.assigneeId ?? null,
          sortOrder: i,
          createdById: simi.id,
        },
      });
    }
  }

  const existingGuests = await db.guest.count();
  if (existingGuests === 0) {
    console.log("Seeding demo guests...");
    const households = [
      "Mugambi, Meru",
      "Mutasa, Harare",
      "Wanjiru",
      "Otieno",
      "Achieng",
      "Kamau",
      "Njoroge",
      "Chebet",
      "Muthoni",
      "Odhiambo",
    ];
    let n = 0;
    for (const household of households) {
      const guestsInHousehold = n % 2 === 0 ? 3 : 3;
      for (let i = 0; i < guestsInHousehold && n < 30; i++, n++) {
        const guest = await db.guest.create({
          data: {
            firstName: `${household.split(",")[0]} Guest ${i + 1}`,
            household,
            side: n % 3 === 0 ? "BRIDE" : n % 3 === 1 ? "GROOM" : "BOTH",
            plusOnes: i === 0 ? 1 : 0,
          },
        });
        await db.guestEvent.create({
          data: {
            guestId: guest.id,
            eventId: eventBySlug.wedding.id,
            rsvp: n % 4 === 0 ? "YES" : n % 4 === 1 ? "INVITED" : n % 4 === 2 ? "MAYBE" : "NOT_INVITED",
          },
        });
      }
    }
  }

  const existingNotes = await db.note.count();
  if (existingNotes === 0) {
    console.log("Seeding demo decision notes...");
    const decisions = [
      { title: "Guest cap", body: "Wedding capped at 180 guests to fit Ridgeview Gardens." },
      { title: "Split ratio", body: "Settle-up stays 50/50 unless we agree otherwise in Settings." },
      { title: "Honeymoon window", body: "Honeymoon booked for the two weeks after the wedding, pending the exact date." },
    ];
    for (const d of decisions) {
      await db.note.create({
        data: { kind: "DECISION", title: d.title, body: d.body, pinned: true, createdById: simi.id },
      });
    }
  }

  const existingTx = await db.transaction.count();
  if (existingTx === 0) {
    console.log("Seeding demo inbox transactions...");
    const rows = [
      { name: "SQ *RIDGEVIEW GARDENS", merchant: "Ridgeview Gardens", amountCents: 400_000, daysAgo: 31 },
      { name: "SAVANNAH LENS STUDIO", merchant: "Savannah Lens Studio", amountCents: 70_000, daysAgo: 15 },
      { name: "WHOLE FOODS MARKET", merchant: "Whole Foods", amountCents: 8_400, daysAgo: 3 },
      { name: "DELTA AIR LINES", merchant: "Delta", amountCents: 210_000, daysAgo: 12 },
      { name: "SHELL OIL", merchant: "Shell", amountCents: 5_200, daysAgo: 2 },
      { name: "TWO RIVERS CATERING", merchant: "Two Rivers Catering Co.", amountCents: 150_000, daysAgo: 9 },
      { name: "PAYROLL DEPOSIT", merchant: null, amountCents: 0, daysAgo: 14 },
      { name: "AMANI BEAUTY BAR", merchant: "Amani Beauty Bar", amountCents: 6_000, daysAgo: 6 },
    ];
    for (const [i, r] of rows.entries()) {
      await db.transaction.create({
        data: {
          externalId: `seed-demo-${i}`,
          source: "CSV",
          date: daysAgo(r.daysAgo),
          name: r.name,
          merchant: r.merchant,
          amountCents: r.amountCents,
          status: "NEW",
        },
      });
    }
  }

  const existingBrief = await db.briefSnapshot.count();
  if (existingBrief === 0) {
    console.log("Seeding one canned brief snapshot...");
    await db.briefSnapshot.create({
      data: {
        markdown: cannedBriefMarkdown(),
        words: cannedBriefMarkdown().split(/\s+/).length,
        trigger: "MANUAL",
      },
    });
  }
}

function fx(amount: number, rate: number): number {
  return Math.round(amount * rate * 100);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}

function cannedBriefMarkdown(): string {
  const now = new Date().toISOString();
  return `# Harusi Brief — Annette & Simi — generated ${now} (Africa/Nairobi)
> How to use this: paste it into any AI chat, then ask your question. Everything below is
> the current truth from the app. Money is USD. "Committed" = agreed but unpaid.

## 1. The wedding
Annette & Simi, Nairobi, Kenya. Target month 2027-08, exact date not yet set.

## 2. Budget at a glance
This is seed data — Phase B's brief.generate() replaces this with a live snapshot.

## 3. By event
(seed placeholder)

## 4. Budget lines
(seed placeholder)

## 5. Upcoming payments
(seed placeholder)

## 6. Vendors
(seed placeholder)

## 7. Recent expenses
(seed placeholder)

## 8. Who has fronted what
(seed placeholder)

## 9. Tasks
(seed placeholder)

## 10. Guests
(seed placeholder)

## 11. Decisions & notes
(seed placeholder)

## 12. Open questions
(seed placeholder)

## 13. Recent activity
(seed placeholder)

## 14. State of play
This is a canned seed brief for local development, not a generated one.

## 15. Glossary
Ruracio: the Kenyan bride-price negotiation and family ceremony. Envelope: an event's
budget allocation. Committed: agreed but unpaid. Fronted: money a person paid out of
pocket. Settle-up: reconciling who owes whom. Inbox: unconfirmed bank transactions.
`;
}

async function main() {
  if (CLEAR) {
    await clearAll();
    return;
  }

  console.log("Seeding base data...");
  const users = await seedBase();
  console.log("Base seed complete.");

  if (DEMO) {
    await seedDemo(users);
    console.log("Demo seed complete.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
