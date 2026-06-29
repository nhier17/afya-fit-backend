import express from "express";
import { eq, ilike, or, and, desc, sql, asc } from "drizzle-orm";
import { db } from "../db";
import { members, memberships, packages, payments } from "../db/schema";
import {generateReceiptNumber} from "../lib/utils";
import { randomUUID} from "node:crypto";

const router = express.Router();

//get all members
router.get("/", async (req, res) => {
    try {
        const { search, type, gender, status, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, Number(page));
        const limitPerPage = Math.max(1, Number(limit));
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        // 🔹 Member filters
        if (search) {
            filterConditions.push(
                or(
                    ilike(members.firstName, `%${search}%`),
                    ilike(members.lastName, `%${search}%`)
                )
            );
        }

        if (type) {
            filterConditions.push(eq(members.memberType, type as any));
        }

        if (gender) {
            filterConditions.push(eq(members.gender, gender as any));
        }

        // 🔹 Membership filter (handled separately)
        const membershipFilter = status
            ? eq(memberships.status, status as any)
            : undefined;

        // 🔹 Base query (JOIN first)
        const baseQuery = db
            .select({
                id: members.id,
                firstName: members.firstName,
                lastName: members.lastName,
                phone: members.phone,
                gender: members.gender,
                createdAt: members.createdAt,

                membershipId: memberships.id,
                startedAt: memberships.startDate,
                endedAt: memberships.endDate,
                status: sql<string>`
        CASE
            WHEN ${memberships.endDate} < NOW() THEN 'expired'
            ELSE ${memberships.status}
        END
    `,

                isActive: sql<boolean>`
        CASE
            WHEN ${memberships.endDate} < NOW() THEN false
            ELSE true
        END
    `,

                totalAmount: memberships.totalAmount,
                paidAmount: sql<number>`
                      COALESCE(
                        (SELECT SUM(p.amount)
                         FROM payments p
                         WHERE p.membership_id = ${memberships.id}
                         AND p.type IN ('package', 'balance')),
                        0
                      )
                        `,
            })
            .from(members)
            .leftJoin(
                memberships,
                eq(members.activeMembershipId, memberships.id)
            );

        // 🔹 Combine filters safely
        const whereClause = [
            ...filterConditions,
            ...(membershipFilter ? [membershipFilter] : []),
        ];

        // 🔹 COUNT (must match main query)
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(members)
            .leftJoin(
                memberships,
                eq(members.activeMembershipId, memberships.id)
            )
            .where(whereClause.length ? and(...whereClause) : undefined);

        const totalCount = countResult[0]?.count ?? 0;

        // 🔹 DATA query
        const membersList = await baseQuery
            .where(whereClause.length ? and(...whereClause) : undefined)
            .orderBy(desc(members.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        // 🔹 Transform (add balance safely)
        const formatted = membersList.map((m) => {
            const total = Number(m.totalAmount || 0);
            const paid = Number(m.paidAmount || 0);

            return {
                ...m,
                balance: total - paid,
            };
        });

        res.status(200).json({
            data: formatted,
            pagination: {
                total: totalCount,
                page: currentPage,
                limit: limitPerPage,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });

    } catch (error) {
        console.error("Get /members error: ", error);
        res.status(500).json({ error: "Failed to fetch members" });
    }
});

//register new member
router.post("/", async (req, res) => {
    const {
        firstName,
        lastName,
        gender,
        phone,
        memberType,
        packageId,
        startDate,
        registrationFee = 0,
        amountPaid = 0,
        paymentMethod,
        paymentDate,
    } = req.body;

    const normalizePhone = (phone: string) => {
        if (phone.startsWith("0")) return "254" + phone.slice(1);
        if (phone.startsWith("+")) return phone.slice(1);
        return phone;
    };

    try {
        if ((amountPaid > 0 || registrationFee > 0) && !paymentMethod) {
            return res.status(400).json({
                error: "Payment method is required when payment is made",
            });
        }

        const result = await db.transaction(async (tx) => {
            // 🔹 1. Get package
            const [pkg] = await tx
                .select()
                .from(packages)
                .where(eq(packages.id, packageId))
                .limit(1);

            if (!pkg) throw new Error("Package not found");

            // 🔹 2. Dates
            const start = new Date(startDate);
            const end = new Date(start);
            end.setDate(start.getDate() + pkg.durationInDays);

            const packagePrice = Number(pkg.price);
            const regFee = Number(registrationFee);
            const packagePaid = Number(amountPaid);

            if (packagePaid > packagePrice) {
                throw new Error(
                    `Amount paid (${packagePaid}) cannot exceed package price (${packagePrice})`
                );
            }

            // 🔹 3. Create member
            const [newMember] = await tx
                .insert(members)
                .values({
                    firstName,
                    lastName,
                    gender,
                    phone: normalizePhone(phone),
                    memberType,
                })
                .returning();

            if (!newMember) {
                throw new Error("Failed to create member")
            }

            // 🔹 4. Create membership
            const [newMembership] = await tx
                .insert(memberships)
                .values({
                    memberId: newMember.id,
                    packageId: pkg.id,
                    startDate: start,
                    endDate: end,
                    registrationFee: regFee.toString(),
                    totalAmount: packagePrice.toString(),
                    paidAmount: "0",
                    status: "active",
                })
                .returning();

            if(!newMembership) {
                throw new Error("Failed to create membership")
            }

            let totalCash = 0;
            const transactionGroupId = randomUUID()
            let paymentsCreated = [];

            // 🔹 5. Registration payment
            if (regFee > 0) {
                const receiptNumber = generateReceiptNumber();

               const [payment] = await tx.insert(payments).values({
                    membershipId: newMembership.id,
                    amount: regFee.toString(),
                    type: "registration",
                    method: paymentMethod,
                    receiptNumber,
                    transactionGroupId,
                    paidAt: paymentDate ? new Date(paymentDate) : new Date(),
                }).returning();

               paymentsCreated.push(payment);
            }

            // 🔹 6. Package payment
            if (packagePaid > 0) {
                const receiptNumber = generateReceiptNumber();

                const [payment] = await tx.insert(payments).values({
                    membershipId: newMembership.id,
                    amount: packagePaid.toString(),
                    type: "package",
                    method: paymentMethod,
                    receiptNumber,
                    transactionGroupId,
                    paidAt: paymentDate ? new Date(paymentDate) : new Date(),
                }).returning();

                totalCash += packagePaid;
                paymentsCreated.push(payment);
            }

            // 🔹 7. Update membership paidAmount (optional cache)
            await tx
                .update(memberships)
                .set({
                    paidAmount: totalCash.toString(),
                })
                .where(eq(memberships.id, newMembership.id));

            // 🔹 8. Link active membership
            await tx
                .update(members)
                .set({
                    activeMembershipId: newMembership.id,
                })
                .where(eq(members.id, newMember.id));

            return {
                member: newMember,
                membership: newMembership,
                payments: paymentsCreated,
                transactionGroupId
            };
        });

        return res.status(201).json({
            success: true,
            message: "Member registered successfully",
            data: result,
        });

    } catch (error: any) {
        console.error("Registration error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to register member",
        });
    }
});

//renew membership
router.post("/:id/renew", async (req, res) => {
    const memberId = Number(req.params.id);

    const {
        packageId,
        amountPaid = 0,
        paymentMethod,
        paymentDate,
        startDate,
    } = req.body;

    // 🔹 Validation
    if (!packageId) {
        return res.status(400).json({ error: "Package is required" });
    }

    if (!startDate) {
        return res.status(400).json({ error: "Start date is required" });
    }

    if (Number(amountPaid) > 0 && !paymentMethod) {
        return res.status(400).json({
            error: "Payment method is required when payment is made",
        });
    }

    try {
        const result = await db.transaction(async (tx) => {

            // 🔹 1. Get member
            const [member] = await tx
                .select()
                .from(members)
                .where(eq(members.id, memberId))
                .limit(1);

            if (!member) throw new Error("Member not found");

            // 🔹 2. Get package
            const [pkg] = await tx
                .select()
                .from(packages)
                .where(eq(packages.id, packageId))
                .limit(1);

            if (!pkg) throw new Error("Package not found");

            // 🔹 3. Dates
            const start = new Date(startDate);
            if (isNaN(start.getTime())) {
                throw new Error("Invalid start date");
            }

            const end = new Date(start);
            end.setDate(start.getDate() + pkg.durationInDays);

            // 🔹 4. Financials (CLEAN MODEL)
            const paid = Math.max(0, Number(amountPaid || 0));
            const packagePrice = Number(pkg.price);
            const balance = packagePrice - paid;

            const paidAt = paymentDate ? new Date(paymentDate) : new Date();

// Expire old membership safely
            if (member.activeMembershipId) {
                await tx
                    .update(memberships)
                    .set({
                        status: "expired",
                        updatedAt: new Date(),
                    })
                    .where(
                        and(
                            eq(memberships.id, member.activeMembershipId),
                            eq(memberships.status, "active")
                        )
                    );
            }

// Create membership
            const [newMembership] = await tx
                .insert(memberships)
                .values({
                    memberId,
                    packageId,
                    startDate: start,
                    endDate: end,
                    totalAmount: packagePrice.toString(),
                    paidAmount: paid.toString(),
                    registrationFee: "0",
                    status: "active",
                })
                .returning();

            if (!newMembership) throw Error;

            const transactionGroupId = randomUUID();
            const paymentsCreated = [];

            if (paid > 0) {
                const receiptNumber = generateReceiptNumber();

                const [payment] = await tx
                    .insert(payments)
                    .values({
                        membershipId: newMembership.id,
                        amount: paid.toString(),
                        type: "package",
                        method: paymentMethod,
                        receiptNumber,
                        transactionGroupId,
                        paidAt,
                    })
                    .returning();

                paymentsCreated.push(payment);
            }

// Update active membership
            await tx
                .update(members)
                .set({
                    activeMembershipId: newMembership.id,
                })
                .where(eq(members.id, memberId));

            return {
                membership: {
                    ...newMembership,
                    balance,
                },
                payments: paymentsCreated,
                transactionGroupId,
            };
        });

        res.status(200).json({
            success: true,
            message: "Membership renewed successfully",
            data: result,
        });

    } catch (error: any) {
        console.error("Renew error:", error);

        res.status(500).json({
            success: false,
            message: error.message || "Failed to renew membership",
        });
    }
});

//get member by id
router.get("/:id", async (req, res) => {
    const memberId = Number(req.params.id);

    try {
        // 🔹 1. Get member
        const memberResult = await db
            .select()
            .from(members)
            .where(eq(members.id, memberId));

        const member = memberResult[0];

        if (!member) {
            return res.status(404).json({ error: "Member not found" });
        }

        if (!member.activeMembershipId) {
            return res.status(404).json({
                error: "No active membership found for this member",
            });
        }

        // 🔹 2. Membership + package
        const membershipResult = await db
            .select({
                id: memberships.id,
                startDate: memberships.startDate,
                endDate: memberships.endDate,

                status: sql<string>`
                    CASE
                        WHEN ${memberships.endDate} < NOW() THEN 'expired'
                        ELSE ${memberships.status}
                    END
                `,

                isActive: sql<boolean>`
                    CASE
                        WHEN ${memberships.endDate} < NOW() THEN false
                        ELSE true
                    END
                `,

                totalAmount: memberships.totalAmount,

                packageName: packages.name,
                durationInDays: packages.durationInDays,
                packagePrice: packages.price,
            })
            .from(memberships)
            .innerJoin(packages, eq(packages.id, memberships.packageId))
            .where(eq(memberships.id, member.activeMembershipId));

        const membership = membershipResult[0];

        if (!membership) {
            return res.status(404).json({ error: "Membership not found" });
        }

        // 🔹 3. Payments (
        const paymentsData = await db
            .select({
                id: payments.id,
                amount: payments.amount,
                type: payments.type,
                method: payments.method,
                paidAt: payments.paidAt,
                transactionGroupId: payments.transactionGroupId,
                membershipId: payments.membershipId,
            })
            .from(payments)
            .innerJoin(
                memberships,
                eq(memberships.id, payments.membershipId)
            )
            .where(eq(memberships.memberId, memberId))
            .orderBy(desc(payments.paidAt), desc(payments.createdAt));

        if (!paymentsData) {
            throw new Error("Payment required")
        }

        // 🔹 4. Financial calculations (FROM PAYMENTS 🔥)

        const packagePaid = paymentsData
            .filter(p => p.type === "package" || p.type === "balance")
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const registrationPaid = paymentsData
            .filter(p => p.type === "registration")
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const totalCash = paymentsData
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const totalAmount = Number(membership.totalAmount);
        const currentMembershipPayments = paymentsData.filter(
            (p) => p.membershipId === membership.id
        );

        const currentMembershipPaid = currentMembershipPayments
            .filter(
                (p) => p.type === "package" || p.type === "balance"
            )
            .reduce((sum, p) => sum + Number(p.amount), 0);

        const balance = totalAmount - currentMembershipPaid;

        const latestGroup = paymentsData[0]?.transactionGroupId;

        const lastPaid = paymentsData
            .filter(p => p.transactionGroupId === latestGroup)
            .reduce((sum, p) => sum + Number(p.amount), 0);

        res.json({
            data: {
                member,
                membership: {
                    ...membership,
                    totalAmount,
                    paidAmount: packagePaid,
                    balance,
                },
                payments: paymentsData,
                stats: {
                    totalCash,
                    packagePaid,
                    registrationPaid,
                    lastPaid,
                    balance,
                },
            },
        });

    } catch (error) {
        console.error("Get member details error:", error);

        res.status(500).json({
            error: "Failed to fetch member details",
        });
    }
});

//pay members balance
router.post("/:id/pay-balance", async (req, res) => {
    const memberId = Number(req.params.id);
    const { amount, paymentMethod, paymentDate } = req.body;

    const payAmount = Math.max(0, Number(amount));

    if (!payAmount) {
        return res.status(400).json({ error: "Valid payment amount is required" });
    }

    const paidAt = paymentDate ? new Date(paymentDate) : new Date();

    if (!paymentMethod) {
        return res.status(400).json({ error: "Payment method is required" });
    }

    try {
        const result = await db.transaction(async (tx) => {

            const [member] = await tx
                .select()
                .from(members)
                .where(eq(members.id, memberId))
                .limit(1);

            if (!member) throw new Error("Member not found");
            if (!member.activeMembershipId) throw new Error("No active membership");

            const [membership] = await tx
                .select()
                .from(memberships)
                .where(eq(memberships.id, member.activeMembershipId))
                .limit(1);

            if (!membership) throw new Error("Membership not found");

            const membershipId = membership.id;
            const packagePrice = Number(membership.totalAmount);
            const currentPaid = Number(membership.paidAmount || 0);
            const currentBalance = packagePrice - currentPaid;

            if (currentBalance <= 0) {
                throw new Error("Membership already fully paid");
            }

            if (payAmount > currentBalance) {
                throw new Error(`Overpayment not allowed. Remaining balance is ${currentBalance}`);
            }

            const receiptNumber = generateReceiptNumber();
            const transactionGroupId = randomUUID();

            const [paymentRecord] = await tx
                .insert(payments)
                .values({
                    membershipId,
                    amount: payAmount.toString(),
                    type: "balance",
                    method: paymentMethod,
                    receiptNumber,
                    transactionGroupId,
                    paidAt,
                })
                .returning();

            // Atomic update (best practice)
            await tx
                .update(memberships)
                .set({
                    paidAmount: sql`${memberships.paidAmount} + ${payAmount}`,
                })
                .where(eq(memberships.id, membershipId));

            return {
                membership: {
                    totalAmount: packagePrice,
                    paidAmount: currentPaid + payAmount,
                    balance: currentBalance - payAmount,
                },
                payment: paymentRecord,
                transactionGroupId
            };
        });

        return res.status(200).json({
            success: true,
            message: "Balance paid successfully",
            data: result,
        });

    } catch (error: any) {
        console.error("Pay balance error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to process payment",
        });
    }
});

// get full payment history for member
router.get("/:id/payments", async (req, res) => {
    const memberId = Number(req.params.id);

    try {
        const membershipsData = await db
            .select({
                membershipId: memberships.id,
                packageName: packages.name,
                totalAmount: memberships.totalAmount,
                startDate: memberships.startDate,
                endDate: memberships.endDate,
                status: memberships.status,
            })
            .from(memberships)
            .innerJoin(
                packages,
                eq(packages.id, memberships.packageId)
            )
            .where(eq(memberships.memberId, memberId))
            .orderBy(desc(memberships.createdAt));

        if (!membershipsData.length) {
            return res.json({
                data: [],
                total: 0,
            });
        }

        const paymentsData = await db
            .select({
                id: payments.id,
                membershipId: payments.membershipId,
                amount: payments.amount,
                type: payments.type,
                method: payments.method,
                paidAt: payments.paidAt,
                createdAt: payments.createdAt,
                transactionGroupId: payments.transactionGroupId,
            })
            .from(payments)
            .innerJoin(
                memberships,
                eq(memberships.id, payments.membershipId)
            )
            .where(eq(memberships.memberId, memberId));

        const formatted = membershipsData.flatMap((membership) => {
            const membershipPayments = paymentsData.filter(
                (p) => p.membershipId === membership.membershipId
            );

            const groupedTransactions = Object.values(
                membershipPayments.reduce((acc, payment) => {
                    const key =
                        payment.transactionGroupId ??
                        payment.id;

                    if (!acc[key]) {
                        acc[key] = {
                            transactionGroupId: key,
                            paidAt: payment.paidAt,
                            paymentMethod: payment.method,
                            amount: 0,
                        };
                    }

                    acc[key].amount += Number(payment.amount);

                    if (
                        new Date(payment.paidAt!).getTime() >
                        new Date(acc[key].paidAt!).getTime()
                    ) {
                        acc[key].paidAt = payment.paidAt;
                    }

                    return acc;
                }, {} as Record<string, any>)
            ).sort(
                (a, b) =>
                    new Date(a.paidAt).getTime() -
                    new Date(b.paidAt).getTime()
            );

            let runningPaid = 0;

            return groupedTransactions.map((transaction) => {
                runningPaid += transaction.amount;

                const balance = Math.max(
                    Number(membership.totalAmount) - runningPaid,
                    0
                );

                return {
                    id: transaction.transactionGroupId,

                    membershipId: membership.membershipId,

                    paidAt: transaction.paidAt,

                    amount: transaction.amount,

                    packageName: membership.packageName,

                    totalAmount: Number(
                        membership.totalAmount
                    ),

                    runningBalance: balance,

                    paymentMethod:
                    transaction.paymentMethod,

                    transactionGroupId:
                    transaction.transactionGroupId,

                    membershipStatus:
                    membership.status,

                    startDate: membership.startDate,
                    endDate: membership.endDate,

                    receivedBy: "Admin",
                };
            });
        });

        const sortedFormatted = formatted.sort(
            (a, b) =>
                new Date(b.paidAt!).getTime() -
                new Date(a.paidAt!).getTime()
        );

        res.json({
            data: sortedFormatted,
            total: sortedFormatted.length,
        });
    } catch (error) {
        console.error("Payments route error:", error);

        res.status(500).json({
            error: "Failed to fetch payments",
        });
    }
});

export default router;