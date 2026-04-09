import "dotenv/config";

async function main() {
  const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const sessionCookie = process.env.TEST_CLERK_SESSION_COOKIE;
  const jobId = process.env.TEST_JOB_ID;

  if (!sessionCookie || !jobId) {
    console.error(
      "Set TEST_CLERK_SESSION_COOKIE and TEST_JOB_ID env vars before running. Get the cookie from your browser devtools."
    );
    process.exit(1);
  }

  console.log("Testing JD analysis (non-streaming)...");
  const jdRes = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__session=${sessionCookie}`,
    },
    body: JSON.stringify({ jobId, type: "jd_analysis" }),
  });
  console.log("JD status:", jdRes.status);
  console.log("JD body:", await jdRes.text());

  console.log("\nTesting resume tailor (streaming)...");
  const streamRes = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__session=${sessionCookie}`,
    },
    body: JSON.stringify({ jobId, type: "resume" }),
  });
  console.log("Stream status:", streamRes.status);
  if (!streamRes.body) {
    console.log("No body");
    return;
  }
  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    process.stdout.write(decoder.decode(value));
  }
  console.log("\n[stream complete]");
}

main().catch(console.error);
