import {
  pgTable,
  uuid,
  text,
  timestamp,
  decimal,
  pgEnum,
  boolean,
  integer,
  varchar,
  jsonb,
  index
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const genderEnum = pgEnum("gender", ["male", "female"]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "expired",
  "inactive",
]);

export const memberTypeEnum = pgEnum("member_type", ["normal", "gym"]);

export const packageCategoryEnum = pgEnum("package_category", [
  "normal",
  "offer",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "m-pesa",
  "paybill",
  "cheque",
]);

export const checkinMethodEnum = pgEnum("checkin_method", [
  "fingerprint",
  "manual",
]);

export const smsStatusEnum = pgEnum("sms_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
]);

export const smsPurposeEnum = pgEnum("sms_purpose", [
  "welcome",
  "reminder",
  "payment",
  "general",
]);

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    gender: genderEnum("gender").notNull(),
    memberType: memberTypeEnum("member_type").notNull(),
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    phoneIdx: index("members_phone_idx").on(table.phone),
  })
);

export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: packageCategoryEnum("category").notNull(),
  durationInDays: integer("duration_in_days").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});


export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id").notNull()
        .references(() => members.id, { onDelete: "restrict" }),
    packageId: uuid("package_id")
        .notNull()
        .references(() => packages.id, { onDelete: "restrict"}),
    paidAmount: decimal("paid_amount", {
      precision: 10,
      scale: 2,
    }).default("0"),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    registrationFee: decimal("registration_fee", {
      precision: 10,
      scale: 2,
    }).default("0"),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    status: membershipStatusEnum("status")
      .default("active")
      .notNull(),
    autoRenew: boolean("auto_renew").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    memberIdx: index("membership_member_idx").on(table.memberId),
    endDateIdx: index("membership_end_date_idx").on(table.endDate),
  })
);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  transactionReference: varchar("transaction_reference", { length: 255 }),
  paidAt: timestamp("paid_at"),
  ...timestamps,
});


export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
        .notNull()
        .references(() => members.id, { onDelete: "cascade" }),
    method: checkinMethodEnum("method").notNull(),
    checkinTime: timestamp("checkin_time").defaultNow().notNull(),
  },
  (table) => ({
    memberIdx: index("checkin_member_idx").on(table.memberId),
  })
);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category"),
  buyingPrice: decimal("buying_price", { precision: 10, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").default(0).notNull(),
  lowStockAlert: integer("low_stock_alert").default(5),
  ...timestamps,
});

export const sales = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  soldBy: uuid("sold_by").references(() => users.id),
  ...timestamps,
});

export const saleItems = pgTable("sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  ...timestamps,
});

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  category: text("category"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method"),
  expenseDate: timestamp("expense_date").defaultNow().notNull(),
  createdBy: uuid("created_by"),
  ...timestamps,
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  permissions: jsonb("permissions").notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});


export const smsLogs = pgTable("sms_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  memberId: uuid("member_id")
      .references(() => members.id, { onDelete: "set null" }),
  phone: varchar("phone", { length: 20 }).notNull(),
  message: text("message").notNull(),
  purpose: smsPurposeEnum("purpose").notNull(),
  status: smsStatusEnum("status").default("queued"),
  provider: text("provider"),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  ...timestamps,
});