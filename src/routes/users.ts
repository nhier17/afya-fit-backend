import express from "express";
import { and, desc, eq, ilike, or, sql, getTableColumns } from "drizzle-orm";
import { db } from "../db";
import {user} from "../db/schema";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { search, role, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(
                or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`))
            );
        }

        if (role) {
            filterConditions.push(eq(user.role, role as UserRoles));
        }

        const whereClause =
            filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const usersList = await db
            .select()
            .from(user)
            .where(whereClause)
            .orderBy(desc(user.createdAt))
            .limit(limitPerPage)
            .offset(offset)

        res.status(200).json({
            data: usersList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        })
    } catch (error) {
        console.error("GET /users error:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

//get user details
router.get("/:id", async (req, res) => {
    try {
        const userId = req.params.id;

        const [userRecord] = await db
            .select()
            .from(user)
            .where(eq(user.id, userId));

        if (!userRecord) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({ data: userRecord });

    } catch (error) {
        console.error("GET /users/:id error:", error);
        res.status(500).json({ error: "Failed to fetch user" });
    }
})

export default router