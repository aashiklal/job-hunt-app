import type { Metadata } from "next";
import { requireApprovedUserWithPlan } from "@/lib/auth-helpers";
import { StarStoryForm } from "../_components/star-story-form";

export const metadata: Metadata = {
  title: "New STAR story: JobHunt",
  description: "Create a new behavioral interview story.",
};

export default async function NewStarStoryPage() {
  await requireApprovedUserWithPlan();
  return (
    <div className="space-y-8 px-4 md:px-6 lg:px-8 py-6 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        New story
      </h1>
      <StarStoryForm mode="create" />
    </div>
  );
}
