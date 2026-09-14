import { describe, it, expect } from "vitest";
import type { BriefData } from "./brief-data";
import { buildBrief, HEADINGS, withStateOfPlay } from "./brief-markdown";

/**
 * DESIGN.md §8: fifteen headings, in that exact order, built deterministically
 * from the data. The dataset below is seeded in memory so these assertions
 * never depend on a database or a clock.
 */

const NOW = new Date("2026-10-01T09:00:00.000Z");

function seeded(overrides: Partial<BriefData> = {}): BriefData {
  const base: BriefData = {
    now: NOW,
    appName: "Harusi",
    wedding: {
      coupleNames: "Annette & Simi",
      city: "Nairobi",
      country: "Kenya",
      eventTimezone: "Africa/Nairobi",
      targetMonth: "2027-08",
      weddingDate: new Date("2027-08-14T09:00:00.000Z"),
      budgetCents: 5_000_000,
      splitNumerator: 1,
      splitDenominator: 2,
    },
    events: [
      { slug: "ruracio", name: "Ruracio", date: new Date("2027-03-06T09:00:00.000Z"), budgetCents: 800_000 },
      { slug: "wedding", name: "Wedding", date: new Date("2027-08-14T09:00:00.000Z"), budgetCents: 3_200_000 },
      { slug: "honeymoon", name: "Honeymoon", date: null, budgetCents: 700_000 },
      { slug: "party", name: "Joint bachelor / bachelorette", date: null, budgetCents: 300_000 },
      { slug: "general", name: "General", date: null, budgetCents: 0 },
    ],
    summary: {
      totalCents: 5_000_000,
      envelopes: [
        {
          eventSlug: "ruracio",
          eventName: "Ruracio",
          budgetCents: 800_000,
          paidCents: 11_538,
          committedCents: 0,
          plannedCents: 500_000,
          forecastCents: 500_000,
          status: "ON_TRACK",
        },
        {
          eventSlug: "wedding",
          eventName: "Wedding",
          budgetCents: 3_200_000,
          paidCents: 400_000,
          committedCents: 800_000,
          plannedCents: 0,
          forecastCents: 1_200_000,
          status: "ON_TRACK",
        },
      ],
      unallocatedCents: 0,
      paidCents: 411_538,
      committedCents: 800_000,
      forecastCents: 1_700_000,
      remainingCents: 3_788_462,
      status: "ON_TRACK",
    },
    lines: [
      {
        eventName: "Ruracio",
        categoryName: "Ruracio gifts",
        plannedCents: 500_000,
        actualCents: 11_538,
      },
    ],
    duePayments: [
      {
        dueDate: new Date("2026-09-20T09:00:00.000Z"),
        label: "Deposit",
        amountCents: 400_000,
        status: "OPEN",
        vendor: { name: "Ridgeview Gardens" },
      },
      {
        dueDate: new Date("2026-12-01T09:00:00.000Z"),
        label: "Balance",
        amountCents: 800_000,
        status: "OPEN",
        vendor: { name: "Ridgeview Gardens" },
      },
    ],
    vendors: [
      {
        name: "Ridgeview Gardens",
        status: "BOOKED",
        quotedCents: 1_200_000,
        paidCents: 400_000,
        notes: "Garden ceremony,   marquee included",
        contactName: "Wanjiru",
        phone: "+254700000000",
        whatsapp: null,
        email: "hello@ridgeview.example",
        category: { name: "Venue" },
        event: { name: "Wedding" },
        nextDue: {
          label: "Balance",
          dueDate: new Date("2026-12-01T09:00:00.000Z"),
          amountCents: 800_000,
        },
      },
    ],
    recentExpenses: [
      {
        date: new Date("2026-09-28T09:00:00.000Z"),
        description: "Ruracio venue hold",
        amountCents: 11_538,
        originalAmount: 15_000,
        originalCurrency: "KES",
        event: { name: "Ruracio" },
        funder: { name: "Simi" },
        vendor: null,
      },
    ],
    settle: {
      annette: {
        userId: "u_annette",
        name: "Annette",
        frontedCents: 400_000,
        fairShareCents: 205_769,
        balanceCents: 194_231,
      },
      simi: {
        userId: "u_simi",
        name: "Simi",
        frontedCents: 11_538,
        fairShareCents: 205_769,
        balanceCents: -194_231,
      },
      jointCents: 0,
      familyCents: 0,
      owedFromUserId: "u_simi",
      owedToUserId: "u_annette",
      owedCents: 194_231,
      settlements: [],
    },
    tasks: [
      {
        title: "Set the wedding date",
        status: "OPEN",
        dueDate: new Date("2026-09-15T09:00:00.000Z"),
        milestone: true,
        event: { name: "Wedding" },
        assignee: { name: "Simi", settings: { displayName: "Simi" } },
      },
      {
        title: "Shortlist caterers",
        status: "OPEN",
        dueDate: new Date("2026-10-20T09:00:00.000Z"),
        milestone: false,
        event: { name: "Wedding" },
        assignee: null,
      },
      {
        title: "Book the venue",
        status: "DONE",
        dueDate: new Date("2026-08-01T09:00:00.000Z"),
        milestone: true,
        event: { name: "Wedding" },
        assignee: null,
      },
    ],
    openTasksByEvent: [{ eventName: "Wedding", count: 2 }],
    guestCounts: {
      wedding: { total: 30, YES: 8, NO: 2, MAYBE: 5, INVITED: 15, heads: 11 },
    },
    pendingHouseholds: ["Mugambi, Meru"],
    notes: [
      { kind: "DECISION", title: "Guest cap", body: "Wedding capped at 180 guests.", pinned: true },
      { kind: "QUESTION", title: "Band or DJ", body: "Do we want a live band?", pinned: false },
      { kind: "IDEA", title: "Favours", body: "Kanga cloth favours.", pinned: false },
      { kind: "DIGEST", title: "This week", body: "{}", pinned: false },
    ],
    activity: [
      { createdAt: new Date("2026-09-28T09:00:00.000Z"), summary: "Simi added Ruracio venue hold, $115.38" },
    ],
  };

  return { ...base, ...overrides };
}

describe("the Brief's deterministic sections", () => {
  it("has all fifteen headings, in order", () => {
    const { markdown } = buildBrief(seeded());
    const withParagraph = withStateOfPlay(markdown, "Everything is broadly on track.");

    let cursor = -1;
    for (const heading of HEADINGS) {
      const at = withParagraph.indexOf(`\n${heading}\n`);
      expect(at, `missing ${heading}`).toBeGreaterThan(-1);
      expect(at, `${heading} is out of order`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("omits section 14 entirely when AI is off, keeping the other fourteen in order", () => {
    const { markdown } = buildBrief(seeded());
    const withoutParagraph = withStateOfPlay(markdown, null);

    expect(withoutParagraph).not.toContain("## 14. State of play");
    expect(withoutParagraph).not.toContain("@@STATE_OF_PLAY@@");

    let cursor = -1;
    for (const heading of HEADINGS.filter((h) => !h.startsWith("## 14."))) {
      const at = withoutParagraph.indexOf(`\n${heading}\n`);
      expect(at, `missing ${heading}`).toBeGreaterThan(-1);
      expect(at).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("opens with the title line and the how-to-use note", () => {
    const { markdown } = buildBrief(seeded());
    expect(markdown.startsWith("# Harusi Brief — Annette & Simi — generated 2026-10-01T")).toBe(true);
    expect(markdown).toContain("(Africa/Nairobi)");
    expect(markdown).toContain("> How to use this: paste it into any AI chat");
    expect(markdown).toContain('"Committed" = agreed but unpaid.');
  });

  it("takes the app name from APP_NAME rather than hardcoding it", () => {
    const { markdown } = buildBrief(seeded({ appName: "Something Else" }));
    expect(markdown.startsWith("# Something Else Brief —")).toBe(true);
  });

  it("formats money as USD, exact to the cent, never as raw cents", () => {
    const { markdown } = buildBrief(seeded());
    expect(markdown).toContain("$50,000.00");
    expect(markdown).toContain("$115.38");
    expect(markdown).toContain("$12,000.00");
    expect(markdown).not.toContain("5000000");
    expect(markdown).not.toContain("11538");
  });

  it("counts the days to go and renders event dates in the wedding timezone", () => {
    const { markdown } = buildBrief(seeded());
    expect(markdown).toContain("2027-08-14");
    expect(markdown).toContain("days to go");
  });

  it("falls back to the target month when no date is set", () => {
    const data = seeded();
    data.wedding.weddingDate = null;
    const { markdown } = buildBrief(data);
    expect(markdown).toContain("2027-08 (exact date not set)");
    expect(markdown).not.toContain("days to go");
  });

  it("marks a payment already past its due date as overdue", () => {
    const { markdown } = buildBrief(seeded());
    // 2026-09-20 is before the fixed "now" of 2026-10-01.
    expect(markdown).toContain("| 2026-09-20 | Ridgeview Gardens | Deposit | $4,000.00 | OVERDUE |");
  });

  it("groups vendors under their event and collapses notes to one line", () => {
    const { markdown } = buildBrief(seeded());
    expect(markdown).toContain("### Wedding");
    expect(markdown).toContain("Garden ceremony, marquee included");
    expect(markdown).toContain("+254700000000");
  });

  it("shows the original currency alongside the USD amount", () => {
    const { markdown } = buildBrief(seeded());
    expect(markdown).toContain("$115.38 (KES 15000)");
  });

  it("splits tasks into overdue, due soon and milestones", () => {
    const { markdown } = buildBrief(seeded());
    expect(markdown).toContain("**Overdue (1)**");
    expect(markdown).toContain("**Due in the next 30 days (1)**");
    expect(markdown).toContain("Set the wedding date");
    expect(markdown).toContain("Book the venue"); // a done milestone still lists
  });

  it("names who owes whom", () => {
    const { markdown } = buildBrief(seeded());
    expect(markdown).toContain("**Simi owes Annette $1,942.31.**");
  });

  it("says they are square when nobody owes anything", () => {
    const data = seeded();
    data.settle.owedCents = 0;
    data.settle.owedFromUserId = null;
    data.settle.owedToUserId = null;
    const { markdown } = buildBrief(data);
    expect(markdown).toContain("**They are square.**");
  });

  it("raises open questions from the numbers as well as the notes", () => {
    const { markdown } = buildBrief(seeded());
    expect(markdown).toContain("Do we want a live band?");
    expect(markdown).toContain("Wedding has an envelope of $32,000.00 but no planned lines.");
    expect(markdown).toContain("Honeymoon has no date set.");
  });

  it("flags an unallocated remainder and an over-allocated one", () => {
    const over = seeded();
    over.summary.unallocatedCents = -50_000;
    expect(buildBrief(over).markdown).toContain("Envelopes exceed the total budget by $500.00");

    const under = seeded();
    under.summary.unallocatedCents = 120_000;
    expect(buildBrief(under).markdown).toContain(
      "$1,200.00 of the budget is not allocated to any envelope."
    );
  });

  it("keeps the digest note out of the notes sections", () => {
    const { markdown } = buildBrief(seeded());
    expect(markdown).not.toContain("**This week**");
  });

  it("handles an entirely empty wedding without throwing", () => {
    const empty: BriefData = {
      ...seeded(),
      events: [],
      summary: {
        totalCents: 0,
        envelopes: [],
        unallocatedCents: 0,
        paidCents: 0,
        committedCents: 0,
        forecastCents: 0,
        remainingCents: 0,
        status: "ON_TRACK",
      },
      lines: [],
      duePayments: [],
      vendors: [],
      recentExpenses: [],
      tasks: [],
      openTasksByEvent: [],
      guestCounts: {},
      pendingHouseholds: [],
      notes: [],
      activity: [],
    };

    const { markdown } = buildBrief(empty);
    for (const heading of HEADINGS.filter((h) => !h.startsWith("## 14."))) {
      expect(markdown).toContain(heading);
    }
    expect(markdown).toContain("_No planned lines yet — envelopes only._");
    expect(markdown).toContain("_No vendors yet._");
    expect(markdown).toContain("_None yet._"); // the empty tables
    expect(markdown).toContain("_Nothing yet._"); // recent activity
    expect(markdown).toContain("_None recorded._"); // decisions
  });

  it("hands the model only sections 2, 3, 5, 9 and 12", () => {
    const { forModel } = buildBrief(seeded());
    expect(forModel).toContain(HEADINGS[1]);
    expect(forModel).toContain(HEADINGS[2]);
    expect(forModel).toContain(HEADINGS[4]);
    expect(forModel).toContain(HEADINGS[8]);
    expect(forModel).toContain(HEADINGS[11]);
    expect(forModel).not.toContain(HEADINGS[5]); // vendors
    expect(forModel).not.toContain(HEADINGS[14]); // glossary
  });
});
