import express from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "../db";
import { payments, memberships, members, packages } from "../db/schema/app";

const router = express.Router();

//receipt
router.get("/payments/:id/receipt", async (req, res) => {
    const { transactionGroupId } = req.body;

    try {
        const transactionPayments = await db
            .select({
                paymentId: payments.id,
                receiptNumber: payments.receiptNumber,
                amount: payments.amount,
                type: payments.type,
                method: payments.method,
                paidAt: payments.paidAt,

                memberId: members.id,

                memberName: sql<string>`
                        ${members.firstName} || ' ' || ${members.lastName}
                    `,

                phone: members.phone,

                membershipId: memberships.id,

                packageName: packages.name,

                startDate: memberships.startDate,
                endDate: memberships.endDate,
            })
            .from(payments)
            .innerJoin(
                memberships,
                eq(memberships.id, payments.membershipId)
            )
            .innerJoin(
                members,
                eq(members.id, memberships.memberId)
            )
            .innerJoin(
                packages,
                eq(packages.id, memberships.packageId)
            )
            .where(
                eq(
                    payments.transactionGroupId,
                    transactionGroupId
                )
            )
            .orderBy(payments.createdAt);

        if (!transactionPayments) throw Error;

        const totalPaid = transactionPayments.reduce(
            (sum, payment) =>
                sum + Number(payment.amount),
            0
        );

        // 🔥 Shared metadata
        const firstPayment = transactionPayments[0];

        res.json({ data: transactionPayments });

    } catch (error) {
        console.error("Receipt fetch error:", error);

        res.status(500).json({
            error: "Failed to fetch receipt",
        });
    }
});

export default router;
