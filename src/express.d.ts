declare global {
    namespace Express {
        interface Request {
            user?: {
                role?: "admin" | "user";
            };
        }
    }
}

export {};