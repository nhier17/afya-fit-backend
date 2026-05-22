import { Router } from "express";
import { db } from "../db";
import {memberships, packages} from "../db/schema";
import {and, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";

const router = Router();

//get all packages with category filter
router.get("/", async (req, res) => {
    try {
        const { search, category } = req.query;
        const filterConditions = [];
        if (search) {
            filterConditions.push(
                or(
                    ilike(packages.name, `%${search}%`)
                )
            )
        }
        if (category) {
            filterConditions.push(eq(packages.category, category as any))
        }
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const packagesList = await db
                .select({
                ...getTableColumns((packages)),
                      })
                .from(packages)
                .where(whereClause)
                .orderBy(desc(packages.createdAt))
        ;

        res.status(200).json({
            data: packagesList,
            total: packagesList.length,
        });
    } catch (error) {
        console.error("Get /packages error: ", error);
        res.status(500).json({ error: "Failed to fetch packages" });
    }
});

// CREATE PACKAGE
router.post("/", async (req, res) => {
    const { name, category, durationInDays, price } = req.body;

    try {
        // 🔹 1. Validation
        if (!name || !category || !durationInDays || !price) {
            return res.status(400).json({
                error: "All fields are required",
            });
        }

        if (!["normal", "offer"].includes(category)) {
            return res.status(400).json({
                error: "Invalid category",
            });
        }

        if (Number(durationInDays) <= 0) {
            return res.status(400).json({
                error: "Duration must be greater than 0",
            });
        }

        if (Number(price) <= 0) {
            return res.status(400).json({
                error: "Price must be greater than 0",
            });
        }

        // 🔹 2. Prevent duplicate package names
        const existing = await db
            .select()
            .from(packages)
            .where(eq(packages.name, name))
            .limit(1);

        if (existing.length > 0) {
            return res.status(400).json({
                error: "Package with this name already exists",
            });
        }

        // 🔹 3. Create package
        const [newPackage] = await db
            .insert(packages)
            .values({
                name,
                category,
                durationInDays: Number(durationInDays),
                price: price.toString(), // decimal safety
                isActive: true,
            })
            .returning();

        return res.status(201).json({
            success: true,
            message: "Package created successfully",
            data: newPackage,
        });

    } catch (error: any) {
        console.error("Create package error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create package",
        });
    }
});

// GET PACKAGE BY ID
router.get("/:id", async (req, res) => {
    try {
        const packageId = Number(req.params.id);

        if (!Number.isFinite(packageId)) {
            return res.status(400).json({ error: "Invalid package ID" });
        }
        const [packageData] = await db
            .select()
            .from(packages)
            .where(eq(packages.id, packageId));

        if (!packageData) {
            return res.status(404).json({ error: "Package not found" });
        }

        const [memberCount] = await Promise.all([
            db
                .select({ count: sql<number>`count(*)`})
                .from(memberships)
                .where(eq(memberships.packageId, packageId))
        ])
        res.status(200).json({
            data: packageData,
            totals: memberCount[0]?.count ?? 0,
        });

    } catch (error) {
        console.error("Get /packages/:id error: ", error);
        res.status(500).json({ error: "Failed to fetch package" });
    }
});

export default router;