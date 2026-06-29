import { Router } from "express";
import { db } from "../db";
import { products, inventoryMovements, saleItems } from "../db/schema";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";

const router = Router();

// GET /products
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
                    ilike(products.name, `%${search}%`),
                    ilike(products.category, `%${search}%`)
                )
            );
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(products)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const productsList = await db
            .select({
                ...getTableColumns(products)
            })
            .from(products)
            .where(whereClause)
            .limit(limitPerPage)
            .offset(offset)
            .orderBy(desc(products.createdAt));

        res.status(200).json({
            data: productsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });

    } catch (error) {
        console.error("Get /products error: ", error);
        res.status(500).json({ error: "Failed to fetch products" });
    }
});

// GET /products/:id
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const stockQuery = db
            .select({
                productId: inventoryMovements.productId,
                stock: sql<number>`COALESCE(SUM(${inventoryMovements.quantity}), 0) - COALESCE((
                    SELECT SUM(${saleItems.quantity})
                    FROM ${saleItems}
                    WHERE ${saleItems.productId} = ${inventoryMovements.productId}
                ), 0)`.as("stock"),
            })
            .from(inventoryMovements)
            .groupBy(inventoryMovements.productId)
            .as("stock_counts");

        const [product] = await db
            .select({
                ...getTableColumns(products),
                stockQuantity: sql<number>`COALESCE(${stockQuery.stock}, 0)`,
            })
            .from(products)
            .leftJoin(stockQuery, eq(products.id, stockQuery.productId))
            .where(eq(products.id, id))
            .limit(1);

        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.status(200).json({ data: product });
    } catch (error) {
        console.error("Get /products/:id error: ", error);
        res.status(500).json({ error: "Failed to fetch product" });
    }
});

// POST /products
router.post("/", async (req, res) => {
    try {
        const {
            name,
            category,
            sku,
            buyingPrice,
            sellingPrice,
            lowStockAlert,
            stockQuantity,
        } = req.body;

        // Validation
        if (!name || !sellingPrice) {
            return res.status(400).json({ error: "Name and selling price are required" });
        }

        if (buyingPrice !== undefined && Number(sellingPrice) < Number(buyingPrice)) {
            return res.status(400).json({ error: "Selling price cannot be less than buying price" });
        }

        if (sku) {
            const [existingSku] = await db
                .select()
                .from(products)
                .where(eq(products.sku, sku))
                .limit(1);

            if (existingSku) {
                return res.status(400).json({ error: "SKU must be unique" });
            }
        }


            const [newProduct] = await db
                .insert(products)
                .values({
                    name,
                    category,
                    sku,
                    buyingPrice: buyingPrice?.toString(),
                    sellingPrice: sellingPrice.toString(),
                    stockQuantity,
                    lowStockAlert: lowStockAlert !== undefined ? Number(lowStockAlert) : undefined,
                })
                .returning();

            if (!newProduct) throw Error;

        res.status(201).json({
            success: true,
            message: "Expense recorded successfully",
            data: newProduct
        });
    } catch (error) {
        console.error("Post /products error: ", error);
        res.status(500).json({ error: "Failed to create product" });
    }
});

// PATCH /products/:id
router.patch("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const [existingProduct] = await db
            .select()
            .from(products)
            .where(eq(products.id, id))
            .limit(1);

        if (!existingProduct) {
            return res.status(404).json({ error: "Product not found" });
        }

        const finalBuyingPrice = updates.buyingPrice !== undefined ? updates.buyingPrice : existingProduct.buyingPrice;
        const finalSellingPrice = updates.sellingPrice !== undefined ? updates.sellingPrice : existingProduct.sellingPrice;

        if (Number(finalSellingPrice) < Number(finalBuyingPrice)) {
            return res.status(400).json({ error: "Selling price cannot be less than buying price" });
        }

        if (updates.sku && updates.sku !== existingProduct.sku) {
            const [existingSku] = await db
                .select()
                .from(products)
                .where(eq(products.sku, updates.sku))
                .limit(1);

            if (existingSku) {
                return res.status(400).json({ error: "SKU must be unique" });
            }
        }

        const [updatedProduct] = await db
            .update(products)
            .set({
                ...updates,
                buyingPrice: updates.buyingPrice !== undefined ? updates.buyingPrice.toString() : undefined,
                sellingPrice: updates.sellingPrice !== undefined ? updates.sellingPrice.toString() : undefined,
                lowStockAlert: updates.lowStockAlert !== undefined ? Number(updates.lowStockAlert) : undefined,
                updatedAt: new Date(),
            })
            .where(eq(products.id, id))
            .returning();

        res.status(200).json({ data: updatedProduct });
    } catch (error) {
        console.error("Patch /products/:id error: ", error);
        res.status(500).json({ error: "Failed to update product" });
    }
});

// DELETE /products/:id
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [existingProduct] = await db
            .select()
            .from(products)
            .where(eq(products.id, id))
            .limit(1);

        if (!existingProduct) {
            return res.status(404).json({ error: "Product not found" });
        }

        await db.delete(products).where(eq(products.id, id));

        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error("Delete /products/:id error: ", error);
        res.status(500).json({ error: "Failed to delete product" });
    }
});

export default router;
