import express from "express";
import { eq, ilike, or, and, desc, sql, getTableColumns } from "drizzle-orm";
import { db } from "../db";
import { members, memberships, packages, payments } from "../db/schema/app";

const router = express.Router();

//get all members
router.get("/", async (req, res) => {
    try {
        const { search, type, gender, status, page=1, limit=10 } = req.query;

        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(members.firstName, `%${search}%`),
                    ilike(members.lastName, `%${search}%`)
                )
            )
        }
        if (type) {
            filterConditions.push(eq(members.memberType, type as any))
        }
        if (status) {
            filterConditions.push(eq(members.isActive, status === "active"))
        }

        if (gender) {
            filterConditions.push(eq(members.gender, gender as any))
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
             .select({ count: sql<number>`count(*)` })
             .from(members)
            .leftJoin(memberships, eq(memberships.memberId, members.id))
             .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const membersList = await db
            .select({
                id: members.id,
                firstName: members.firstName,
                lastName: members.lastName,
                phone: members.phone,
                gender: members.gender,
                createdAt: members.createdAt,

                startedAt: memberships.startDate,
                endedAt: memberships.endDate,
                status: memberships.status,
            })
            .from(members)
            .leftJoin(memberships, eq(memberships.memberId, members.id))
            .where(whereClause)
            .orderBy(desc(members.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: membersList,
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

    // 🔹 Normalize phone (Kenya format)
    const normalizePhone = (phone: string) => {
        if (phone.startsWith("0")) return "254" + phone.slice(1);
        if (phone.startsWith("+")) return phone.slice(1);
        return phone;
    };

    try {
        // 🔹 Basic validation
        if (amountPaid > 0 && !paymentMethod) {
            return res.status(400).json({
                error: "Payment method is required when amount is provided",
            });
        }

        const result = await db.transaction(async (tx) => {
            // 🔹 1. Get package
            const [pkg] = await tx
                .select()
                .from(packages)
                .where(eq(packages.id, packageId))
                .limit(1);

            if (!pkg) {
                throw new Error("Package not found");
            }

            // 🔹 2. Calculate dates
            const start = new Date(startDate);
            const end = new Date(start);
            end.setDate(start.getDate() + pkg.durationInDays);

            // 🔹 3. Financials
            const packagePrice = Number(pkg.price);
            const regFee = Number(registrationFee || 0);
            const paid = Number(amountPaid || 0);

            const totalAmount = packagePrice + regFee;

            // 🔹 4. Create member
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

            if (!newMember) throw new Error("Failed to create member");

            // 🔹 5. Create membership
            const [newMembership] = await tx
                .insert(memberships)
                .values({
                    memberId: newMember.id,
                    packageId: pkg.id,
                    startDate: start,
                    endDate: end,
                    registrationFee: regFee.toString(),
                    totalAmount: totalAmount.toString(),
                    paidAmount: paid.toString(),
                    status: "active",
                })
                .returning();

            if (!newMembership) throw new Error("Failed to create membership");

            // 🔹 6. Create payment (if any)
            let paymentRecord = null;

            if (paid > 0) {
                [paymentRecord] = await tx
                    .insert(payments)
                    .values({
                        membershipId: newMembership.id,
                        amount: paid.toString(),
                        method: paymentMethod,
                        paidAt: paymentDate ? new Date(paymentDate) : new Date(),
                    })
                    .returning();
            }

            return {
                member: newMember,
                membership: newMembership,
                payment: paymentRecord,
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

//get member by id
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [member] = await db
            .select()
            .from(members)
            .where(eq(members.id, id))
            .limit(1);

        if (!member) {
            return res.status(404).json({ error: "Member not found" });
        }

        res.json(member);
    } catch (error) {
        console.error("Get /members/:id error: ", error);
        res.status(500).json({ error: "Failed to fetch member" });
    }
});

export default router;