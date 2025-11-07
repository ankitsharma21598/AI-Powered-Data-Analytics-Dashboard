import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LineChartVizProps {
  data: any[];
  config?: {
    title?: string;
    description?: string;
    xKey?: string;
    lines?: { dataKey: string; stroke?: string; name?: string }[];
  };
}

export function LineChartViz({ data, config }: LineChartVizProps) {
  const title = config?.title || "Line Chart";
  const sample = Array.isArray(data) && data.length > 0 ? data[0] : ({} as any);
  const xKey =
    config?.xKey ||
    Object.keys(sample).find((k) => typeof sample[k] !== "number") ||
    "name";
  const lines =
    config?.lines ||
    (() => {
      const numericKeys = Object.keys(sample).filter(
        (k) => typeof sample[k] === "number"
      );
      if (numericKeys.length > 0) {
        return numericKeys.map((k) => ({ dataKey: k, name: k }));
      }
      return [{ dataKey: "value", name: "Value" }];
    })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {config?.description && (
          <CardDescription>{config.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
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
            {lines.map((line, idx) => (
              <Line
                key={idx}
                type="monotone"
                dataKey={line.dataKey}
                stroke="#8884d8"
                name={line.name}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
