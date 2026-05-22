import { Router } from "express";
import { db } from "../db";
import { expenses } from "../db/schema";
import { and, desc, eq, getTableColumns, ilike, or } from "drizzle-orm";

const router = Router();

// GET all expenses with filtering and search
router.get("/", async (req, res) => {
    try {
        const { search, category } = req.query;
        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(
                    ilike(expenses.category, `%${search}%`)
                )
            );
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const expensesList = await db
            .select({
                ...getTableColumns(expenses),
            })
            .from(expenses)
            .where(whereClause)
            .orderBy(desc(expenses.createdAt));

        res.status(200).json({
            data: expensesList,
            total: expensesList.length,
        });
    } catch (error) {
        console.error("Get /expenses error: ", error);
        res.status(500).json({ error: "Failed to fetch expenses" });
    }
});

// CREATE EXPENSE
router.post("/", async (req, res) => {
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
                // createdBy: ... (add user id if authentication is implemented)
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
