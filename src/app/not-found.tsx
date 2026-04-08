import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-900">
            Page not found
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            The page you are looking for does not exist or has been moved.
          </p>
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link href="/">Go home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
