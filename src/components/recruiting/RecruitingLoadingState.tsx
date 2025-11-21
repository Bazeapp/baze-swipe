import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function RecruitingLoadingState() {
  return (
    <>
      <Card className="lg:col-span-6 border-border">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>

          <Skeleton className="h-40 w-full rounded-md" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-16 w-full rounded-md" />
            ))}
          </div>

          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-5 w-full rounded-md" />
            ))}
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3 border-border">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-32 w-full rounded-md" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-4 w-full rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
