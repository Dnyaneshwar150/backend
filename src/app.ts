import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import apiRoutes from "./routes/index";
import { globalErrorHandler } from "./middleware/errorHandler";
import { AppError } from "./utils/AppError";

const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cors());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", apiRoutes);

app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

app.use(globalErrorHandler);

export default app;
