import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler} from "better-auth/node";

import {autoExpireMemberships} from "./cron/expire";

import membersRoutes from "./routes/members";
import userRoutes from "./routes/users";
import packagesRoutes from "./routes/packages";
import paymentsRoutes from "./routes/payments";
import expensesRoutes from "./routes/expenses";
import dashboardRoutes from "./routes/dashboard";
import dailyRoutes from "./routes/daily";
import productsRoutes from "./routes/products";
import salesRoutes from "./routes/sales";
import {auth} from "./lib/auth";


const app = express();
const PORT = process.env.PORT || 8000;

//cors options
const corsOptions = {
  origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
};

app.use(cors(corsOptions));

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.use("/api/members", membersRoutes);
app.use("/api/users", userRoutes);
app.use("/api/packages", packagesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/daily", dailyRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/sales", salesRoutes);

autoExpireMemberships();

app.get("/", (req, res) => {
    res.send("Backend server is running!");
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});