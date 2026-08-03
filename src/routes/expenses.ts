import { Router } from "express";
import { db } from "../db";
import {expenses, products} from "../db/schema";
import {and, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import {requireAuth} from "../middleware/auth";

const router = Router();

// GET all expenses with filtering and search
router.get("/", async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(expenses.category, `%${search}%`)
                )
            );
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(expenses)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const expensesList = await db
            .select({
                ...getTableColumns(expenses),
            })
            .from(expenses)
            .where(whereClause)
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(expenses.createdAt));

        res.status(200).json({
            data: expensesList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });
    } catch (error) {
        console.error("Get /expenses error: ", error);
        res.status(500).json({ error: "Failed to fetch expenses" });
    }
});

// CREATE EXPENSE
router.post("/", requireAuth, async (req, res) => {
    const { name, amount, datePaid, description } = req.body;

    try {
        // 🔹 1. Validation
        // Note: The schema in app.ts has 'category' and 'amount', but the frontend sends 'name' (which is the category).
        if (!name || !amount || !datePaid) {
            return res.status(400).json({
                error: "Name, amount, and date are required",
            });
        }

        if (Number(amount) <= 0) {
            return res.status(400).json({
                error: "Amount must be greater than 0",
            });
        }

        // 🔹 2. Create expense
        const [newExpense] = await db
            .insert(expenses)
            .values({
                category: name,
                amount: amount.toString(),
                expenseDate: new Date(datePaid),
                createdBy: req.user!.id
            })
            .returning();

        return res.status(201).json({
            success: true,
            message: "Expense recorded successfully",
            data: newExpense,
        });

    } catch (error: any) {
        console.error("Create expense error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to record expense",
        });
    }
});

export default router;
