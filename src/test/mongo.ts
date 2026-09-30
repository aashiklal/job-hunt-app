import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Real MongoDB for tests that exercise database behaviour rather than our own
 * logic. The concurrency tests in particular depend on atomic findOneAndUpdate
 * and on unique indexes actually being enforced, neither of which a mock can
 * demonstrate.
 */

let server: MongoMemoryServer | null = null;

export async function startTestMongo(): Promise<void> {
  server = await MongoMemoryServer.create();
  const uri = server.getUri();

  // connect.ts reads MONGODB_URI if its cache is cold. Setting it means the
  // harness works regardless of module import order.
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri, { dbName: "test" });

  // connect.ts captures its cache object once at module load, so the fields
  // have to be mutated in place. Replacing global.__mongoose wholesale would
  // leave the already-bound reference pointing at the old object.
  global.__mongoose ??= { conn: null, promise: null };
  global.__mongoose.conn = mongoose;
  global.__mongoose.promise = Promise.resolve(mongoose);
}

export async function stopTestMongo(): Promise<void> {
  if (global.__mongoose) {
    global.__mongoose.conn = null;
    global.__mongoose.promise = null;
  }
  delete process.env.MONGODB_URI;
  await mongoose.disconnect();
  await server?.stop();
  server = null;
}

/**
 * Clears every collection between tests. Faster than restarting the server and
 * keeps tests independent of each other's ordering.
 */
export async function clearTestMongo(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
}

/**
 * Builds the indexes declared on the models under test. Mongoose creates
 * indexes lazily in the background, which is too late for a test that depends
 * on a unique constraint being live.
 */
export async function syncIndexes(
  ...models: Array<{ syncIndexes: () => Promise<unknown> }>
): Promise<void> {
  for (const model of models) {
    await model.syncIndexes();
  }
}
