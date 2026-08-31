import { Skeleton } from "@/components/ui/states";

export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-in-soft">
      <div className="pb-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-3.5 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[86px]" />
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
