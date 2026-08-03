import { Router } from "express";
import { db } from "../db";
import { products, inventoryMovements, saleItems, sales } from "../db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import {requireAuth} from "../middleware/auth";

const router = Router();

// GET /sales
router.get("/", async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, Number(page));
        const limitPerPage = Math.max(1, Number(limit));
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (search) {
            filterConditions.push(eq(sales.id, search as string));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        // Count query
        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(sales)
            .where(whereClause);

        const total = Number(countResult[0]?.count ?? 0);

        // Data query
        const data = await db.query.sales.findMany({
            where: whereClause,
            orderBy: [desc(sales.createdAt)],
            limit: limitPerPage,
            offset: offset,
            with: {
                saleItems: {
                    with: {
                        product: true
                    }
                },
                soldBy: true
            }
        });

        res.status(200).json({
            data,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total,
                totalPages: Math.ceil(total / limitPerPage),
            },
        });
    } catch (error) {
        console.error("Get /sales error: ", error);
        res.status(500).json({ error: "Failed to fetch sales" });
    }
});

// POST /sales
router.post("/",requireAuth, async (req, res) => {
    try {
        const {
            paymentMethod,
            notes,
            discountAmount = 0,
            items,
        } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                error: "At least one item is required",
            });
        }

        if (!paymentMethod) {
            return res.status(400).json({
                error: "Payment method is required",
            });
        }

        const result = await db.transaction(async (tx) => {
            let subtotalAmount = 0;

            const saleItemsData: any[] = [];
            const stockUpdates: {
                productId: string;
                quantity: number;
            }[] = [];

            // Validate all items first
            for (const item of items) {
                const { productId, quantity } = item;

                if (!productId) {
                    throw new Error("Product ID is required");
                }

                if (!quantity || quantity <= 0) {
                    throw new Error("Quantity must be greater than 0");
                }

                const [product] = await tx
                    .select()
                    .from(products)
                    .where(eq(products.id, productId))
                    .limit(1);

                if (!product) {
                    throw new Error(
                        `Product not found: ${productId}`
                    );
                }

                if (product.stockQuantity < quantity) {
                    throw new Error(
                        `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`
                    );
                }

                const unitPrice = Number(product.sellingPrice);
                const costPrice = Number(product.buyingPrice ?? 0);

                const lineTotal = unitPrice * quantity;

                subtotalAmount += lineTotal;

                saleItemsData.push({
                    productId,
                    quantity,
                    unitPrice: unitPrice.toString(),
                    costPrice: costPrice.toString(),
                });

                stockUpdates.push({
                    productId,
                    quantity,
                });
            }

            const finalTotal =
                subtotalAmount - Number(discountAmount);

            if (finalTotal < 0) {
                throw new Error(
                    "Discount cannot exceed sale total"
                );
            }

            // Create sale
            const [newSale] = await tx
                .insert(sales)
                .values({
                    totalAmount: finalTotal.toString(),
                    discountAmount: discountAmount.toString(),
                    paymentMethod,
                    soldBy: req.user!.id,
                    notes: notes ?? null,
                    isVoided: false,
                })
                .returning();

            if (!newSale) {
                throw new Error("Failed to create sale");
            }

            // Insert sale items
            await tx.insert(saleItems).values(
                saleItemsData.map((item) => ({
                    ...item,
                    saleId: newSale.id,
                }))
            );

            // Update stock + inventory movements
            for (const update of stockUpdates) {
                await tx
                    .update(products)
                    .set({
                        stockQuantity: sql`
                            ${products.stockQuantity} - ${update.quantity}
                        `,
                        updatedAt: new Date(),
                    })
                    .where(eq(products.id, update.productId));

                await tx.insert(inventoryMovements).values({
                    productId: update.productId,
                    quantity: -update.quantity,
                    type: "sale",
                    createdBy: req.user!.id,
                });
            }

            return newSale;
        });

        return res.status(201).json({
            success: true,
            message: "Sale recorded successfully",
            data: result,
        });
    } catch (error: any) {
        console.error("POST /sales error:", error);

        return res.status(400).json({
            error:
                error.message ??
                "Failed to record sale",
        });
    }
});

// GET /sales/:id
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const sale = await db.query.sales.findFirst({
            where: eq(sales.id, id),
            with: {
                saleItems: {
                    with: {
                        product: {
                            columns: {
                                id: true,
                                name: true,
                                sku: true,
                                category: true
                            }
                        }
                    }
                },
                soldBy: true
            }
        });

        if (!sale) {
            return res.status(404).json({ error: "Sale not found" });
        }

        // Map to expected format
        const responseData = {
            id: sale.id,
            totalAmount: sale.totalAmount,
            paymentMethod: sale.paymentMethod,
            notes: sale.notes,
            soldBy: sale.soldBy,
            createdAt: sale.createdAt,
            items: sale.saleItems.map(item => ({
                id: item.id,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                costPrice: item.costPrice,
                lineTotal: (Number(item.quantity) * Number(item.unitPrice)).toString(),
                product: item.product
            }))
        };

        res.status(200).json({ data: responseData });
    } catch (error) {
        console.error("Get /sales/:id error: ", error);
        res.status(500).json({ error: "Failed to fetch sale" });
    }
});

// POST /sales/:id/void
router.post("/:id/void", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.transaction(async (tx) => {
            const [sale] = await tx
                .select()
                .from(sales)
                .where(eq(sales.id, id))
                .limit(1);

            if (!sale) {
                throw new Error("Sale not found");
            }

            if (sale.isVoided) {
                throw new Error("Sale is already voided");
            }

            const items = await tx
                .select()
                .from(saleItems)
                .where(eq(saleItems.saleId, id));

            // 1. Mark sale as voided
            const [updatedSale] = await tx
                .update(sales)
                .set({
                    isVoided: true,
                    voidedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(sales.id, id))
                .returning();

            // 2. Restore inventory
            const inventoryMovementsToInsert = items.map(item => ({
                productId: item.productId,
                quantity: item.quantity, // Positive quantity to restore
                type: "voided_sale",
                createdBy: req.user!.id,
            }));

            if (inventoryMovementsToInsert.length > 0) {
                await tx.insert(inventoryMovements).values(inventoryMovementsToInsert);
            }

            return updatedSale;
        });

        res.status(200).json({ data: result });
    } catch (error: any) {
        console.error("Post /sales/:id/void error: ", error);
        res.status(400).json({ error: error.message || "Failed to void sale" });
    }
});

export default router;
