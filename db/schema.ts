import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * All money columns are USD, stored as `numeric` so the pricing maths stays
 * exact in the database. `mode: "number"` hands them back as plain JS numbers,
 * which is safe at these magnitudes and keeps the API responses unsurprising.
 */

export const userRoles = ["user", "admin"] as const;
export const userRoleEnum = pgEnum("user_role", userRoles);
export type UserRole = (typeof userRoles)[number];

export const riskBands = ["A", "B", "C"] as const;
export const riskBandEnum = pgEnum("risk_band", riskBands);
export type RiskBand = (typeof riskBands)[number];

/** The three financing terms every quote is offered. */
export const offerTermYears = [5, 10, 15] as const;
export type OfferTermYears = (typeof offerTermYears)[number];

/**
 * One installment offer, as returned by the pricing model. Stored inline on
 * the quote (see `quotes.offers`) rather than in a third table: a quote always
 * has exactly these three, they are derived values that never change once
 * computed, and nothing reads an offer without its quote.
 */
export type QuoteOffer = {
  termYears: OfferTermYears;
  /** Annual percentage rate, as a percentage — `6.9` means 6.9%. */
  apr: number;
  principalUsed: number;
  monthlyPayment: number;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    /** Never the password itself — hashed at the auth layer before it lands here. */
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Case-insensitive, so Ada@test.com cannot sign up alongside ada@test.com.
    uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
  ],
);

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // --- Request inputs -----------------------------------------------
    // Name, email and address are copied onto the quote rather than read back
    // off the user, so an old quote still shows what was actually quoted after
    // the user edits their profile or moves house.
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    address: text("address").notNull(),
    monthlyConsumptionKwh: numeric("monthly_consumption_kwh", {
      precision: 10,
      scale: 2,
      mode: "number",
    }).notNull(),
    systemSizeKw: numeric("system_size_kw", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    /** Optional on the form; absent means 0, which keeps `principal` total. */
    downPayment: numeric("down_payment", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),

    // --- Derived by the pricing model ---------------------------------
    /** systemSizeKw * 1200. */
    systemPrice: numeric("system_price", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    /** systemPrice - downPayment. */
    principal: numeric("principal", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    riskBand: riskBandEnum("risk_band").notNull(),
    /** Base APR for the band, as a percentage — `6.9` means 6.9%. */
    apr: numeric("apr", { precision: 5, scale: 2, mode: "number" }).notNull(),
    offers: jsonb("offers").$type<QuoteOffer[]>().notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Covers both "my quotes, newest first" and the admin view filtered by user.
    index("quotes_user_id_created_at_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    // The admin view searches by name/email across every user's quotes.
    index("quotes_email_idx").on(table.email),
    check(
      "quotes_monthly_consumption_kwh_positive",
      sql`${table.monthlyConsumptionKwh} > 0`,
    ),
    check("quotes_system_size_kw_positive", sql`${table.systemSizeKw} > 0`),
    check("quotes_down_payment_non_negative", sql`${table.downPayment} >= 0`),
    check(
      "quotes_principal_matches_price",
      sql`${table.principal} = ${table.systemPrice} - ${table.downPayment}`,
    ),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  quotes: many(quotes),
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
  user: one(users, {
    fields: [quotes.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
