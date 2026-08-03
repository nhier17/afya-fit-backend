import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { Request, Response, NextFunction } from "express";


export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });

        if (!session) {
            return res.status(401).json({
                error: "Unauthorized",
            });
        }

        req.user = session.user;
        req.session = session.session;

        next();
    } catch (error) {
        console.error(error);

        return res.status(401).json({
            error: "Unauthorized",
        });
    }
}