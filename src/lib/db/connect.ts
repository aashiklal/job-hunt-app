import "server-only";

import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var __mongoose: MongooseCache | undefined;
}

const cache: MongooseCache =
  global.__mongoose ?? (global.__mongoose = { conn: null, promise: null });

export default async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  if (!cache.promise) {
    // "jobhunt" predates the Offerstitch rename. It names the live database, so
    // changing it would point the app at an empty one.
    cache.promise = mongoose.connect(uri, { dbName: "jobhunt" }).then((instance) => {
      console.log("MongoDB connected");
      return instance;
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Drop the rejected promise so a transient failure (e.g. a DNS timeout)
    // is retried on the next request instead of being cached until restart.
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
