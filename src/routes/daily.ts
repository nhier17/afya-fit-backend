import express from "express";
import { eq, ilike, or, and, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { dailyMembers, packages } from "../db/schema/app";

const router = express.Router();

// Get all daily members
router.get("/", async (req, res) => {
    try {
        const { search, gender, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, Number(page));
        const limitPerPage = Math.max(1, Number(limit));
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(dailyMembers.firstName, `%${search}%`),
                    ilike(dailyMembers.lastName, `%${search}%`),
                    ilike(dailyMembers.phone, `%${search}%`)
                )
            );
        }

        if (gender) {
            filterConditions.push(eq(dailyMembers.gender, gender as any));
        }

        const baseQuery = db
            .select({
                id: dailyMembers.id,
                firstName: dailyMembers.firstName,
                lastName: dailyMembers.lastName,
                phone: dailyMembers.phone,
                gender: dailyMembers.gender,
                amountPaid: dailyMembers.amountPaid,
                paymentMethod: dailyMembers.paymentMethod,
                paymentDate: dailyMembers.paymentDate,
                isActive: dailyMembers.isActive,
                packageName: packages.name,
                createdAt: dailyMembers.createdAt,
            })
            .from(dailyMembers)
            .leftJoin(packages, eq(dailyMembers.packageId, packages.id));

        const whereClause = filterConditions.length ? and(...filterConditions) : undefined;

        // COUNT
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(dailyMembers)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        // DATA
        const membersList = await baseQuery
            .where(whereClause)
            .orderBy(desc(dailyMembers.paymentDate))
            .limit(limitPerPage)
            .offset(offset);

        res.json({
            data: membersList,
            pagination: {
                total: totalCount,
                page: currentPage,
                limit: limitPerPage,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });

    } catch (error) {
        console.error("Get /daily error: ", error);
        res.status(500).json({ error: "Failed to fetch daily members" });
    }
});

// Register new daily member
router.post("/", async (req, res) => {
    const {
        firstName,
        lastName,
        gender,
        phone,
        packageId,
        amountPaid,
        paymentMethod,
        paymentDate,
    } = req.body;

    const normalizePhone = (phone: string) => {
        if (!phone) return "";
        if (phone.startsWith("0")) return "254" + phone.slice(1);
        if (phone.startsWith("+")) return phone.slice(1);
        return phone;
    };

    try {
        const result = await db.transaction(async (tx) => {
            // 1. Get package
            const [pkg] = await tx
                .select()
                .from(packages)
                .where(eq(packages.id, packageId))
                .limit(1);

            if (!pkg) {
                throw new Error("Package not found");
            }

            // 2. Create daily member
            const [newDailyMember] = await tx
                .insert(dailyMembers)
                .values({
                    firstName,
                    lastName,
                    gender,
                    phone: normalizePhone(phone),
                    packageId,
                    amountPaid: amountPaid.toString(),
                    paymentMethod,
                    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                })
                .returning();

            return newDailyMember;
        });

        res.status(201).json({
            message: "Daily member registered successfully",
            data: result,
        });

    } catch (error: any) {
        console.error("Post /daily error: ", error);
        res.status(400).json({ error: error.message || "Failed to register daily member" });
    }
});

export default router;
