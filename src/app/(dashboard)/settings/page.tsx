import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings — Job Hunt",
  description: "Manage your account settings.",
};

export default function SettingsPage() {
  return <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>;
}
