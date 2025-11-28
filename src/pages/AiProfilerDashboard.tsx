import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  XAxis,
  BarChart,
  Bar,
} from "recharts";
import { StatusCards } from "@/components/dashboard/StatusCards";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecruitingHeader } from "@/components/recruiting/RecruitingHeader";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DonutChart } from "@/components/dashboard/DonutChart";

type ProfilerStatus = "pending" | "done" | "reviewed" | string;
type Decision = "pass" | "no_pass" | "ambiguous" | string;

type AiProfilerResult = {
  id: string;
  processo_res_id?: string | null;
  worker_id?: string | null;
  decision?: Decision | null;
  score?: number | null;
  reason?: string | null;
  areas?: string | null;
  risk_flags?: string[] | null;
  version?: string | null;
  raw_result?: string | null;
  created_at?: string | null;
  status?: ProfilerStatus | null;
  error?: string | null;
};

type DecisionOverride = {
  ai_decision?: string | null;
  recruiter_decision?: string | null;
  recruiter_name?: string | null;
  worker_id?: string | null;
  processo_res_id?: string | null;
  reason?: string | null;
  created_at?: string | null;
};

type FetchState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "success" };

const STATUSES: ProfilerStatus[] = ["pending", "done", "reviewed"];
const DECISIONS: Decision[] = ["pass", "no_pass", "ambiguous"];
const DECISION_COLORS: Record<Decision, string> = {
  pass: "hsl(var(--chart-1))",
  no_pass: "hsl(var(--chart-2))",
  ambiguous: "hsl(var(--chart-3))",
};

const getStatusCounts = (rows: AiProfilerResult[]) =>
  STATUSES.reduce<Record<string, number>>((acc, key) => {
    acc[key] = rows.filter((r) => r.status === key).length;
    return acc;
  }, {});

const getDecisionCounts = (rows: AiProfilerResult[]) =>
  DECISIONS.reduce<Record<string, number>>((acc, key) => {
    acc[key] = rows.filter((r) => r.decision === key).length;
    return acc;
  }, {});

const percent = (part: number, total: number) =>
  total === 0 ? "0%" : `${((part / total) * 100).toFixed(1)}%`;

type PeriodCount = {
  date: string; // YYYY-MM-DD
  pending: number;
  done: number;
  reviewed: number;
  total: number;
};

const buildStackedSeries = (
  rows: AiProfilerResult[],
  days: number
): PeriodCount[] => {
  const map = new Map<string, PeriodCount>();
  rows.forEach((row) => {
    if (!row.created_at) return;
    const d = new Date(row.created_at);
    if (Number.isNaN(d.getTime())) return;
    const key = d.toISOString().slice(0, 10);
    const status = (row.status ?? "").toString();
    const bucket = map.get(key) ?? {
      date: key,
      pending: 0,
      done: 0,
      reviewed: 0,
      total: 0,
    };
    if (status === "pending") bucket.pending += 1;
    else if (status === "reviewed") bucket.reviewed += 1;
    else bucket.done += 1;
    bucket.total += 1;
    map.set(key, bucket);
  });

  const dates = Array.from(map.keys()).sort();
  if (dates.length === 0) return [];
  const end = new Date(dates[dates.length - 1]);
  const series: PeriodCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const bucket = map.get(key) ?? {
      date: key,
      pending: 0,
      done: 0,
      reviewed: 0,
      total: 0,
    };
    series.push(bucket);
  }
  return series;
};

type ChartSlice = { label: string; value: number; color: string };

const DecisionDonutChart = ({
  data,
  control,
}: {
  data?: ChartSlice[];
  control?: React.ReactNode;
}) => {
  const slices = Array.isArray(data) ? data : [];
  const total = slices.reduce((sum, d) => sum + d.value, 0);
  return (
    <DonutChart
      title="Decision overview"
      description="Distribuzione decisioni"
      data={slices.map((s) => ({
        label: s.label,
        value: s.value,
        color: s.color,
      }))}
      centerLabel={total.toLocaleString()}
      centerSubLabel="Totale"
      control={control}
      footer={
        <>
          <div className="flex items-center gap-2 leading-none font-medium">
            Aggiornamento live <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-muted-foreground leading-none">
            Ripartizione complessiva delle decisioni
          </div>
        </>
      }
    />
  );
};

const PeriodBarChart = ({
  data,
  control,
}: {
  data: PeriodCount[];
  control?: React.ReactNode;
}) => {
  const chartConfig: ChartConfig = {
    pending: { label: "Pending", color: "hsl(var(--chart-3))" },
    done: { label: "Done/Other", color: "hsl(var(--chart-1))" },
    reviewed: { label: "Reviewed", color: "hsl(var(--chart-2))" },
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Trend per periodo</CardTitle>
          <CardDescription>Ultimi intervalli selezionati</CardDescription>
        </div>
        {control ? <div className="flex items-center">{control}</div> : null}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[240px] w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => {
                const d = new Date(value);
                if (Number.isNaN(d.getTime())) return String(value);
                return d
                  .toLocaleDateString("it-IT", { month: "short", day: "2-digit" })
                  .replace(".", "")
                  .toLowerCase();
              }}
            />
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="pending"
              stackId="a"
              fill="var(--color-pending)"
              radius={[0, 0, 4, 4]}
            />
            <Bar dataKey="done" stackId="a" fill="var(--color-done)" />
            <Bar
              dataKey="reviewed"
              stackId="a"
              fill="var(--color-reviewed)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex gap-2 text-sm text-muted-foreground">
        Trend cumulativo per intervallo selezionato.
      </CardFooter>
    </Card>
  );
};

const OverridesTable = ({ data }: { data: DecisionOverride[] }) => {
  const pageSize = 10;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const pageData = data.slice(page * pageSize, page * pageSize + pageSize);

  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Decision overrides</CardTitle>
        <CardDescription>Ultimi 200 inserimenti HR</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Recruiter</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Processo</TableHead>
              <TableHead>AI</TableHead>
              <TableHead>HR</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Nessun override
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((row, idx) => (
                <TableRow
                  key={`${row.worker_id}-${row.processo_res_id}-${idx}`}
                >
                  <TableCell className="whitespace-nowrap">
                    {row.created_at
                      ? new Date(row.created_at)
                          .toLocaleString("sv-SE")
                          .replace("T", " ")
                      : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.recruiter_name || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.worker_id || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.processo_res_id || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.ai_decision || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {row.recruiter_decision || "-"}
                  </TableCell>
                  <TableCell className="max-w-xl">
                    <div className="line-clamp-2 text-muted-foreground">
                      {row.reason || "-"}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Pagina {page + 1} di {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={page === 0}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

const AiProfilerDashboard = () => {
  const [rows, setRows] = useState<AiProfilerResult[]>([]);
  const [overrideRows, setOverrideRows] = useState<DecisionOverride[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>({
    status: "idle",
  });
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<"90d" | "30d" | "7d">("90d");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setFetchState({ status: "loading" });
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          navigate("/auth");
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supa: any = supabase;
        const pageSize = 1000;
        let from = 0;
        let all: AiProfilerResult[] = [];
        let overrideAll: DecisionOverride[] = [];
        while (true) {
          const { data, error } = await supa
            .from("ai_profiler_results")
            .select(
              "id,processo_res_id,worker_id,decision,score,reason,areas,risk_flags,version,raw_result,created_at,status,error"
            )
            .order("created_at", { ascending: false })
            .range(from, from + pageSize - 1);
          if (error) {
            throw error;
          }
          const chunk = Array.isArray(data) ? data : [];
          all = all.concat(chunk);
          if (chunk.length < pageSize) break;
          from += pageSize;
        }

        // Decision overrides (di solito poche centinaia)
        const { data: overrides, error: overrideError } = await supa
          .from("decision_overrides")
          .select(
            "ai_decision,recruiter_decision,recruiter_name,worker_id,processo_res_id,reason,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(200);
        if (overrideError) {
          throw overrideError;
        }
        overrideAll = Array.isArray(overrides) ? overrides : [];

        if (cancelled) return;
        setRows(all);
        setOverrideRows(overrideAll);
        setFetchState({ status: "success" });
      } catch (err) {
        if (cancelled) return;
        setFetchState({
          status: "error",
          message:
            err instanceof Error ? err.message : "Impossibile caricare i dati",
        });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const total = rows.length;
  const statusCounts = useMemo(() => getStatusCounts(rows), [rows]);
  const [decisionScope, setDecisionScope] = useState<"all" | "done" | "reviewed">("all");
  const decisionCounts = useMemo(() => {
    let source = rows;
    if (decisionScope === "done") {
      source = rows.filter((r) => r.status === "done");
    } else if (decisionScope === "reviewed") {
      source = rows.filter((r) => r.status === "reviewed");
    }
    return getDecisionCounts(source);
  }, [rows, decisionScope]);
  const decisionData = useMemo(
    () =>
      DECISIONS.map((d) => ({
        label:
          d === "no_pass"
            ? "No pass"
            : d === "ambiguous"
            ? "Ambiguous"
            : "Pass",
        value: decisionCounts[d] ?? 0,
        color: DECISION_COLORS[d as Decision],
      })),
    [decisionCounts]
  );
  const filteredSeries = useMemo(() => {
    const days = timeRange === "90d" ? 90 : timeRange === "30d" ? 30 : 7;
    return buildStackedSeries(rows, days);
  }, [rows, timeRange]);

  const effectivenessStats = useMemo(() => {
    const reviewed = rows.filter(
      (r) =>
        r.status === "reviewed" &&
        (r.decision === "pass" || r.decision === "no_pass")
    );
    const aiPass = reviewed.filter((r) => r.decision === "pass").length;
    const aiNoPass = reviewed.filter((r) => r.decision === "no_pass").length;

    const consideredOverrides = overrideRows.filter(
      (r) =>
        (r.ai_decision === "pass" || r.ai_decision === "no_pass") &&
        (r.recruiter_decision === "pass" || r.recruiter_decision === "no_pass")
    );
    const contrPass = consideredOverrides.filter(
      (r) => r.ai_decision === "pass" && r.recruiter_decision === "no_pass"
    ).length;
    const contrNoPass = consideredOverrides.filter(
      (r) => r.ai_decision === "no_pass" && r.recruiter_decision === "pass"
    ).length;

    const passAligned = Math.max(aiPass - contrPass, 0);
    const noPassAligned = Math.max(aiNoPass - contrNoPass, 0);

    const accuracyPass = aiPass === 0 ? 0 : (passAligned / aiPass) * 100;
    const accuracyNoPass =
      aiNoPass === 0 ? 0 : (noPassAligned / aiNoPass) * 100;

    return {
      aiPass,
      aiNoPass,
      contrPass,
      contrNoPass,
      passAligned,
      noPassAligned,
      accuracyPass,
      accuracyNoPass,
    };
  }, [rows, overrideRows]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <RecruitingHeader
        onOpenSidebar={() => {}}
        onLogout={() => {
          supabase.auth.signOut();
          navigate("/auth");
        }}
        currentIndex={0}
        total={0}
        selectedRecruiterName="Dashboard"
        extraActions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/recruiting")}
            >
              Recruiting
            </Button>
          </div>
        }
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold">AI Profiler Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitoraggio run del profiler
          </p>
        </div>

        {fetchState.status === "loading" ? (
          <div className="rounded-lg border border-border bg-card p-4 text-sm">
            Caricamento...
          </div>
        ) : null}
        {fetchState.status === "error" ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Errore: {fetchState.message}
          </div>
        ) : null}

        <StatusCards
          total={total}
          pending={statusCounts.pending ?? 0}
          done={statusCounts.done ?? 0}
          reviewed={statusCounts.reviewed ?? 0}
        />

        <section className="space-y-3">
          <DecisionDonutChart
            data={decisionData}
            control={
              <Select
                value={decisionScope}
                onValueChange={(val) =>
                  setDecisionScope(val as "all" | "done" | "reviewed")
                }
              >
                <SelectTrigger className="w-[160px]" aria-label="Filtro decisioni">
                  <SelectValue placeholder="Filtro decisioni" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </section>

        <section className="space-y-3">
          <PeriodBarChart
            data={filteredSeries}
            control={
              <Select
                value={timeRange}
                onValueChange={(val) =>
                  setTimeRange(val as "7d" | "30d" | "90d")
                }
              >
                <SelectTrigger
                  className="w-[160px]"
                  aria-label="Seleziona periodo"
                >
                  <SelectValue placeholder="Seleziona range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Ultimi 7 giorni</SelectItem>
                  <SelectItem value="30d">Ultimi 30 giorni</SelectItem>
                  <SelectItem value="90d">Ultimi 3 mesi</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </section>

        <section className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2">
            <DonutChart
              title="Efficacia Pass"
              description={`Pass = ${effectivenessStats.aiPass} | Override = ${
                effectivenessStats.contrPass ?? 0
              }`}
              data={[
                {
                  label: "Allineati",
                  value: Math.max(
                    effectivenessStats.aiPass -
                      (effectivenessStats.contrPass ?? 0),
                    0
                  ),
                  color: "hsl(var(--chart-1))",
                },
                {
                  label: "Ribaltati HR",
                  value: effectivenessStats.contrPass ?? 0,
                  color: "hsl(var(--chart-2))",
                },
              ]}
              centerLabel={
                effectivenessStats.aiPass === 0
                  ? "0%"
                  : `${(
                      (Math.max(
                        effectivenessStats.aiPass -
                          (effectivenessStats.contrPass ?? 0),
                        0
                      ) /
                        effectivenessStats.aiPass) *
                      100
                    ).toFixed(1)}%`
              }
            />
            <DonutChart
              title="Efficacia No pass"
              description={`No Pass = ${
                effectivenessStats.aiNoPass
              } | Override = ${effectivenessStats.contrNoPass ?? 0}`}
              data={[
                {
                  label: "Allineati",
                  value: Math.max(
                    effectivenessStats.aiNoPass -
                      (effectivenessStats.contrNoPass ?? 0),
                    0
                  ),
                  color: "hsl(var(--chart-1))",
                },
                {
                  label: "Ribaltati HR",
                  value: effectivenessStats.contrNoPass ?? 0,
                  color: "hsl(var(--chart-2))",
                },
              ]}
              centerLabel={
                effectivenessStats.aiNoPass === 0
                  ? "0%"
                  : `${(
                      (Math.max(
                        effectivenessStats.aiNoPass -
                          (effectivenessStats.contrNoPass ?? 0),
                        0
                      ) /
                        effectivenessStats.aiNoPass) *
                      100
                    ).toFixed(1)}%`
              }
            />
          </div>
        </section>

        <section className="space-y-3">
          <OverridesTable data={overrideRows} />
        </section>
      </div>
    </div>
  );
};

export default AiProfilerDashboard;
