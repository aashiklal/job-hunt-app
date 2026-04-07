import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __mongoose: MongooseCache | undefined;
}

const cache: MongooseCache =
  global.__mongoose ?? (global.__mongoose = { conn: null, promise: null });

export default async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) {
    console.log("Using cached connection");
    return cache.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri).then((instance) => {
      console.log("MongoDB connected");
      return instance;
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
