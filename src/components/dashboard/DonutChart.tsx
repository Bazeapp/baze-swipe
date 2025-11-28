import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  title: string;
  description?: string;
  data: DonutSlice[];
  centerLabel?: string;
  centerSubLabel?: string;
  footer?: React.ReactNode;
  control?: React.ReactNode;
};

export function DonutChart({
  title,
  description,
  data,
  centerLabel,
  centerSubLabel,
  footer,
  control,
}: DonutChartProps) {
  const total = React.useMemo(
    () => data.reduce((acc, curr) => acc + curr.value, 0),
    [data]
  );

  const chartConfig: ChartConfig = React.useMemo(() => {
    const base: ChartConfig = { total: { label: title } };
    data.forEach((slice, idx) => {
      base[`slice-${idx}`] = { label: slice.label, color: slice.color };
    });
    return base;
  }, [data, title]);

  const chartData = data.map((slice, idx) => ({
    key: `slice-${idx}`,
    name: slice.label,
    value: slice.value,
    fill: slice.color,
  }));

  return (
    <Card className="flex flex-col">
      <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-2 pb-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {control ? (
          <div className="flex items-start justify-end">{control}</div>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[260px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {centerLabel ?? total.toLocaleString()}
                        </tspan>
                        {centerSubLabel ? (
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 18}
                            className="fill-muted-foreground text-sm"
                          >
                            {centerSubLabel}
                          </tspan>
                        ) : null}
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      {footer ? (
        <CardFooter className="flex-col gap-2 text-sm">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}
