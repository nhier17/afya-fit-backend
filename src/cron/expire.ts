import cron from "node-cron";
import { db } from "../db";
import { memberships, members } from "../db/schema";
import { lt, eq, and, inArray } from "drizzle-orm";

export const autoExpireMemberships = () => {
    cron.schedule("0 0 * * *", async () => {
        console.log("⏰ Running membership expiry job...");

        const now = new Date();

        try {
            // 🔹 Find expired active memberships
            const expired = await db
                .select({
                    id: memberships.id,
                })
                .from(memberships)
                .where(
                    and(
                        lt(memberships.endDate, now),
                        eq(memberships.status, "active")
                    )
                );

            if (expired.length === 0) {
                console.log("✅ No memberships to expire.");
                return;
            }

            const expiredIds = expired.map(m => m.id);

            // 🔹 Mark memberships as expired
            await db
                .update(memberships)
                .set({
                    status: "expired",
                    updatedAt: new Date(),
                })
                .where(inArray(memberships.id, expiredIds));

            // 🔹 Clear active memberships from members table
            await db
                .update(members)
                .set({
                    activeMembershipId: null,
                    isActive: false,
                })
                .where(inArray(members.activeMembershipId, expiredIds));

            console.log(`✅ Expired ${expiredIds.length} memberships.`);
        } catch (error) {
            console.error("❌ Cron job error:", error);
        }
    });
};