import { Router } from "express";
import { db } from "../db";
import {
    payments,
    expenses,
    memberships,
    members,
    packages,
} from "../db/schema";
import { sql, eq, desc, and } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
    try {
        //Date helpers
        const now = new Date();

        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            1
        );
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        const startOfLastMonth = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1
        );

        //Execute all queries concurrently
        const [
            todayCollectionResult,
            todayExpensesResult,
            monthExpensesResult,
            yesterdayCollectionResult,
            monthCollectionResult,
            lastMonthCollectionResult,
            yearCollectionResult,
            outstandingResult,
            totalMembersResult,
            activeMembersResult,
            expiredMembersResult,
            joinedTodayResult,
            joinedMonthResult,
            renewedTodayResult,
            renewedMonthResult,
            todayPaymentsByMethod,
            monthlyRevenue,
            paymentsByPackage,
        ] = await Promise.all([
            //Financials
            db.select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
                .from(payments)
                .where(sql`${payments.paidAt} >= ${startOfToday}`),
            //today expenses
            db.select({
                total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
            })
                .from(expenses)
                .where(sql`${expenses.expenseDate} >= ${startOfToday}`),

            //monthly expenses
            db.select({
                total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
            })
                .from(expenses)
                .where(
                    sql`${expenses.expenseDate} >= ${startOfMonth}
            AND ${expenses.expenseDate} < ${startOfNextMonth}`
                ),

            db.select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
                .from(payments)
                .where(
                    and(
                        sql`${payments.paidAt} >= ${startOfYesterday}`,
                        sql`${payments.paidAt} < ${startOfToday}`
                    )
                ),

            db.select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
                .from(payments)
                .where(sql`${payments.paidAt} >= ${startOfMonth}`),

            db.select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            }).from(payments).where(sql`${payments.paidAt} >= ${startOfLastMonth}`),

            db.select({
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
                .from(payments)
                .where(sql`${payments.paidAt} >= ${startOfYear}`),

            db.select({
                total: sql<number>`
                    COALESCE(SUM(${memberships.totalAmount} - ${memberships.paidAmount}), 0)
                `,
            })
                .from(memberships)
                .where(eq(memberships.status, "active")),

            //Members
            db.select({ count: sql<number>`COUNT(*)` }).from(members),

            db.select({ count: sql<number>`COUNT(*)` })
                .from(memberships)
                .where(eq(memberships.status, "active")),

            db.select({ count: sql<number>`COUNT(*)` })
                .from(memberships)
                .where(eq(memberships.status, "expired")),

            db.select({ count: sql<number>`COUNT(*)` })
                .from(members)
                .where(sql`${members.createdAt} >= ${startOfToday}`),

            db.select({ count: sql<number>`COUNT(*)` })
                .from(members)
                .where(sql`${members.createdAt} >= ${startOfMonth}`),

            db.select({ count: sql<number>`COUNT(*)` })
                .from(memberships)
                .where(sql`${memberships.createdAt} >= ${startOfToday}`),

            db.select({ count: sql<number>`COUNT(*)` })
                .from(memberships)
                .where(sql`${memberships.createdAt} >= ${startOfMonth}`),

            //Payments by Method
            db.select({
                method: payments.method,
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.as("total"),
            })
                .from(payments)
                .where(sql`${payments.paidAt} >= ${startOfToday}`)
                .groupBy(payments.method),

            //Monthly Revenue
            db.select({
                month: sql<string>`TO_CHAR(${payments.paidAt}, 'Mon')`.as("month"),
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.as("total"),
                monthIndex: sql<number>`EXTRACT(MONTH FROM ${payments.paidAt})`,
            })
                .from(payments)
                .where(sql`${payments.paidAt} >= ${startOfYear}`)
                .groupBy(
                    sql`TO_CHAR(${payments.paidAt}, 'Mon')`,
                    sql`EXTRACT(MONTH FROM ${payments.paidAt})`
                )
                .orderBy(sql`EXTRACT(MONTH FROM ${payments.paidAt})`),

            //Payments by Package
            db.select({
                packageName: packages.name,
                total: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.as("total"),
            })
                .from(payments)
                .innerJoin(
                    memberships,
                    eq(payments.membershipId, memberships.id)
                )
                .innerJoin(
                    packages,
                    eq(memberships.packageId, packages.id)
                )
                .groupBy(packages.name)
                .orderBy(desc(sql`COALESCE(SUM(${payments.amount}), 0)`)),
        ]);

        //Extract single-row results
        const todayCollection = todayCollectionResult[0];
        const yesterdayCollection = yesterdayCollectionResult[0];
        const todayExpenses = todayExpensesResult[0];
        const monthExpenses = monthExpensesResult[0];
        const monthCollection = monthCollectionResult[0];
        const lastMonthCollection = lastMonthCollectionResult[0];
        const yearCollection = yearCollectionResult[0];
        const outstanding = outstandingResult[0];
        const totalMembers = totalMembersResult[0];
        const activeMembers = activeMembersResult[0];
        const expiredMembers = expiredMembersResult[0];
        const joinedToday = joinedTodayResult[0];
        const joinedMonth = joinedMonthResult[0];
        const renewedToday = renewedTodayResult[0];
        const renewedMonth = renewedMonthResult[0];

        // Extract values
        const todayRev = Number(todayCollection?.total);
        const yesterdayRev = Number(yesterdayCollection?.total);
        const monthRev = Number(monthCollection?.total);
        const lastMonthRev = Number(lastMonthCollection?.total);

        //trends
        const todayVsYesterday =
            yesterdayRev === 0
                ? 100
                : ((todayRev - yesterdayRev) / yesterdayRev) * 100;

        const monthVsLastMonth =
            lastMonthRev === 0
                ? 100
                : ((monthRev - lastMonthRev) / lastMonthRev) * 100;

        //Format Payment Methods
        const formattedPayments: Record<string, number> = {
            cash: 0,
            "m-pesa": 0,
            paybill: 0,
            cheque: 0,
        };

        todayPaymentsByMethod.forEach((item) => {
            formattedPayments[item.method] = Number(item.total);
        });

        //Final Response
        res.json({
            success: true,
            data: {
                financials: {
                    todayCollection: Number(todayCollection?.total),
                    todayExpenses: Number(todayExpenses?.total),
                    monthExpenses: Number(monthExpenses?.total),
                    netToday:
                        Number(todayCollection?.total) -
                        Number(todayExpenses?.total),
                    monthCollection: Number(monthCollection?.total),
                    yearCollection: Number(yearCollection?.total),
                    outstandingBalance: Number(outstanding?.total),
                    paymentBreakdownToday: formattedPayments,
                    monthlyRevenue: monthlyRevenue.map((item) => ({
                        month: item.month,
                        amount: Number(item.total),
                    })),
                    paymentsByPackage: paymentsByPackage.map((item) => ({
                        name: item.packageName,
                        value: Number(item.total),
                    })),
                    trends: {
                        todayVsYesterday,
                        monthVsLastMonth
                    }
                },
                members: {
                    total: Number(totalMembers?.count),
                    active: Number(activeMembers?.count),
                    expired: Number(expiredMembers?.count),
                    joinedToday: Number(joinedToday?.count),
                    joinedThisMonth: Number(joinedMonth?.count),
                    renewedToday: Number(renewedToday?.count),
                    renewedThisMonth: Number(renewedMonth?.count),
                },
            },
        });
    } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard stats",
        });
    }
});

export default router;