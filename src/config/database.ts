import mongoose from "mongoose";
import { config } from "./env";

const MONGOOSE_OPTS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000, // Fail fast if MongoDB is unreachable
  socketTimeoutMS: 45000,
};

console.log(process.env.MONGODB_URI);

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on("connected", () => {
    console.log("[MongoDB] Connected successfully");
  });

  mongoose.connection.on("error", (err: Error) => {
    console.error("[MongoDB] Connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Disconnected from database");
  });

  await mongoose.connect(config.mongodb.uri, MONGOOSE_OPTS);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
  console.log("[MongoDB] Connection closed gracefully");
}

// Expose the mongoose connection for transactions
export const getMongooseConnection = (): mongoose.Connection =>
  mongoose.connection;
