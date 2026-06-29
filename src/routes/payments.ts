import express from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "../db";
import { payments, memberships, members, packages } from "../db/schema";

const router = express.Router();

//receipt
// Get receipt by transaction group id
router.get("/:transactionGroupId/receipt", async (req, res) => {
    const { transactionGroupId } = req.params;

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

        if (!transactionPayments || transactionPayments.length === 0) {
            return res.status(404).json({ error: "Receipt not found" });
        }

        const totalPaid = transactionPayments.reduce(
            (sum, payment) => sum + Number(payment.amount),
            0
        );

        const firstPayment = transactionPayments[0];

        res.json({
            data: {
                transactionGroupId,
                totalPaid,
                member: {
                    id: firstPayment.memberId,
                    name: firstPayment.memberName,
                    phone: firstPayment.phone,
                },
                membership: {
                    id: firstPayment.membershipId,
                    packageName: firstPayment.packageName,
                    startDate: firstPayment.startDate,
                    endDate: firstPayment.endDate,
                },
                payments: transactionPayments,
            },
        });

    } catch (error) {
        console.error("Receipt fetch error:", error);

        res.status(500).json({
            error: "Failed to fetch receipt",
        });
    }
});

export default router;
