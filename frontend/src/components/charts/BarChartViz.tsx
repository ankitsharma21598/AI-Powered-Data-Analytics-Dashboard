import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipContentProps,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BarChartVizProps {
  data: any[];
  config?: {
    title?: string;
    description?: string;
    xKey?: string;
    bars?: { dataKey: string; fill?: string; name?: string }[];
  };
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipContentProps<string | number, string>) => {
  const isVisible = active && payload && payload.length;
  //   console.log("payload===>", payload[0].value);

  return (
    <div
      className="custom-tooltip"
      style={{ visibility: isVisible ? "visible" : "hidden" }}
    >
      {isVisible && (
        <>
          <p className="label">{`Count : ${payload[0].value}`}</p>
          {/* <p className="intro">{payload[0].name}</p> */}
          {/* <p className="desc">Anything you want can be displayed here.</p> */}
        </>
      )}
    </div>
  );
};

export function BarChartViz({ data, config }: BarChartVizProps) {
  const title = config?.title || "Bar Chart";
  const xKey = config?.xKey || "name";
  const bars = config?.bars || [
    { dataKey: "value", fill: "hsl(var(--primary))", name: "Value" },
  ];

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
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip content={CustomTooltip} />
            <Legend />
            {bars.map((bar, idx) => (
              <Bar
                key={idx}
                dataKey={bar.dataKey}
                fill={"#8884d8"}
                barSize={20}
                name={bar.name}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
