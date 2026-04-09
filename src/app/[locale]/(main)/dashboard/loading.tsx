import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";

export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-6">
      <DashboardSkeleton />
    </div>
  );
}
