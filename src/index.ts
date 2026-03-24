import "dotenv/config";
import express from "express";
import cors from "cors";

import membersRoutes from "./routes/members";
import packagesRoutes from "./routes/packages";

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

app.get("/", (req, res) => {
    res.send("Backend server is running!");
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});