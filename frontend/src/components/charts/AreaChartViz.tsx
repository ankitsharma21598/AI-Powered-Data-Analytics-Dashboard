import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AreaChartVizProps {
  data: any[];
  config?: {
    title?: string;
    description?: string;
    xKey?: string;
    areas?: { dataKey: string; fill?: string; stroke?: string; name?: string }[];
  };
}

export function AreaChartViz({ data, config }: AreaChartVizProps) {
  const title = config?.title || "Area Chart";
  const xKey = config?.xKey || "name";
  const areas = config?.areas || [{ dataKey: "value", fill: "hsl(var(--primary) / 0.2)", stroke: "hsl(var(--primary))", name: "Value" }];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {config?.description && <CardDescription>{config.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            {areas.map((area, idx) => (
              <Area
                key={idx}
                type="monotone"
                dataKey={area.dataKey}
                stroke={area.stroke || `hsl(var(--chart-${(idx % 5) + 1}))`}
                fill={area.fill || `hsl(var(--chart-${(idx % 5) + 1}) / 0.2)`}
                name={area.name}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
