import express from "express";
import cors from "cors";

import companiesRoutes from "./routes/companiesRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import servicesRoutes from "./routes/servicesRoutes.js";
import vehiclesRoutes from "./routes/vehiclesRoutes.js";
import requestsRoutes from "./routes/requestsRoutes.js";
import notificationsRoutes from "./routes/notificationsRoutes.js";
import communityRoutes from "./routes/communityRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFoundHandler } from "./middlewares/notFoundHandler.js";
import { requestLogger } from "./middlewares/requestLogger.js";

const app = express();

app.disable("x-powered-by");

app.use(express.json());
app.use(cors());
app.use(requestLogger);

app.use("/api/auth", authRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/companies", companiesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/requests", requestsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/community", communityRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
