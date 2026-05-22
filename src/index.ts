import "dotenv/config";
import express from "express";
import cors from "cors";

import {autoExpireMemberships} from "./cron/expire";

import membersRoutes from "./routes/members";
import packagesRoutes from "./routes/packages";
import paymentsRoutes from "./routes/payments";
import expensesRoutes from "./routes/expenses";
import dashboardRoutes from "./routes/dashboard";
import dailyRoutes from "./routes/daily";

const app = express();
const PORT = process.env.PORT || 8000;

//cors options
const corsOptions = {
  origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());

app.use("/api/members", membersRoutes);
app.use("/api/packages", packagesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/daily", dailyRoutes);

autoExpireMemberships();

app.get("/", (req, res) => {
    res.send("Backend server is running!");
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});