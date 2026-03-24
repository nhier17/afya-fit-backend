import { Router } from "express";
import { db } from "../db";
import { packages } from "../db/schema";
import { eq } from "drizzle-orm";

const router = Router();

//get all packages
router.get("/", async (req, res) => {
    try {
        const allPackages = await db.select().from(packages);

        res.status(200).json({
            data: allPackages,
            total: allPackages.length,
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

export default router;