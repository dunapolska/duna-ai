"use client";

import { useUser } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Witaj, {user?.firstName || user?.emailAddresses[0].emailAddress}!
          </h1>
          <p className="text-gray-600">Miło Cię widzieć</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Tutaj będzie treść Twojego dashboardu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Zalogowano jako: {user?.emailAddresses[0].emailAddress}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
