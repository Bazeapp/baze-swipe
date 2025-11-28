import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type StatusCardsProps = {
  total: number;
  pending: number;
  done: number;
  reviewed: number;
};

const formatPercent = (part: number, total: number) =>
  total === 0 ? "0%" : `${((part / total) * 100).toFixed(1)}%`;

export function StatusCards({
  total,
  pending,
  done,
  reviewed,
}: StatusCardsProps) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-2 sm:px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:grid-cols-2 lg:grid-cols-4">
      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription>Totale record</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {total.toLocaleString()}
          </CardTitle>
          <Badge variant="outline" className="w-fit">
            <TrendingUp className="h-4 w-4" />
            +0%
          </Badge>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Totale risultati <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground">Ai profiler results</div>
        </CardFooter>
      </Card>

      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription>Pending</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {pending.toLocaleString()}
          </CardTitle>
          <Badge variant="outline" className="w-fit">
            <TrendingUp className="h-4 w-4" />
            {formatPercent(pending, total)}
          </Badge>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            In coda <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground">Profiler non eseguito</div>
        </CardFooter>
      </Card>

      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription>Done</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {done.toLocaleString()}
          </CardTitle>
          <Badge variant="outline" className="w-fit">
            <TrendingUp className="h-4 w-4" />
            {formatPercent(done, total)}
          </Badge>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Completate <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground">
            Profiler eseguito ma non valutato
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card" data-slot="card">
        <CardHeader>
          <CardDescription>Reviewed</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {reviewed.toLocaleString()}
          </CardTitle>
          <Badge variant="outline" className="w-fit">
            <TrendingDown className="h-4 w-4" />
            {formatPercent(reviewed, total)}
          </Badge>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Revisionate <TrendingDown className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground">
            Profiler eseguito e valutato da HR
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
