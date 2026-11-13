import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// explained and connected are reserved for later releases and never set in release 1.
export const topicState = pgEnum("topic_state", [
  "new",
  "in_progress",
  "learned",
  "recalled",
  "explained",
  "connected",
]);

export const fields = pgTable("fields", {
  code: text().primaryKey(),
  name: text().notNull(),
  realm: text().notNull(),
  kind: text().notNull(),
  season: integer(),
  lens: text().notNull(),
  level2: jsonb().$type<string[]>().notNull(),
});

export const topics = pgTable("topics", {
  id: text().primaryKey(),
  fieldCode: text("field_code")
    .notNull()
    .references(() => fields.code),
  level: integer().notNull(),
  season: integer().notNull(),
  seq: integer().notNull(),
  title: text().notNull(),
  question: text().notNull(),
});

export const topicPrereqs = pgTable(
  "topic_prereqs",
  {
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id),
    prereqId: text("prereq_id")
      .notNull()
      .references(() => topics.id),
  },
  (t) => [primaryKey({ columns: [t.topicId, t.prereqId] })],
);

export const edges = pgTable(
  "edges",
  {
    a: text()
      .notNull()
      .references(() => topics.id),
    b: text()
      .notNull()
      .references(() => topics.id),
    why: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.a, t.b] })],
);

export const lessons = pgTable("lessons", {
  topicId: text("topic_id")
    .primaryKey()
    .references(() => topics.id),
  pack: jsonb().notNull(),
  status: text().notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey(),
  tz: text().notNull(),
  sessionMinutes: integer("session_minutes").notNull().default(30),
  maxNewPerDay: integer("max_new_per_day").notNull().default(2),
  fieldsOff: jsonb("fields_off").$type<string[]>().notNull().default([]),
  plannedReturn: date("planned_return"),
});

export const topicProgress = pgTable(
  "topic_progress",
  {
    userId: uuid("user_id").notNull(),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id),
    state: topicState().notNull().default("new"),
    cardIndex: integer("card_index").notNull().default(0),
    learnedAt: timestamp("learned_at", { withTimezone: true }),
    box: integer(),
    dueAt: date("due_at"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    successStreak: integer("success_streak").notNull().default(0),
    failStreak: integer("fail_streak").notNull().default(0),
    lapsed: boolean().notNull().default(false),
    parked: boolean().notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.topicId] })],
);

export const itemHistory = pgTable("item_history", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id").notNull(),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id),
  itemId: text("item_id").notNull(),
  askedAt: timestamp("asked_at", { withTimezone: true }).notNull(),
  grade: text().notNull(),
  context: text().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id").notNull(),
    sessionDay: date("session_day").notNull(),
    kind: text().notNull(),
    mode: text().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    summary: jsonb(),
  },
  (t) => [unique().on(t.userId, t.sessionDay, t.kind)],
);

export const flags = pgTable("flags", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid("user_id").notNull(),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id),
  ref: text().notNull(),
  note: text().notNull(),
  status: text().notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
