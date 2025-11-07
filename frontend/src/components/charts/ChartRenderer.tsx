import { LineChartViz } from "./LineChartViz";
import { BarChartViz } from "./BarChartViz";
import { PieChartViz } from "./PieChartViz";
import { AreaChartViz } from "./AreaChartViz";

interface ChartRendererProps {
  type: string;
  data: any;
  config?: any;
}

export function ChartRenderer({ type, data, config }: ChartRendererProps) {
  // Transform data if it's in columnar format (e.g., {quarters: [], sales: []})
  let chartData: any[] = [];
  
  if (Array.isArray(data)) {
    chartData = data;
  } else if (data && typeof data === 'object') {
    // Handle columnar format - find the array fields and combine them row-wise
    const keys = Object.keys(data as any);
    const arrayKeys = keys.filter((k) => Array.isArray((data as any)[k]));

    if (arrayKeys.length > 0) {
      const length = Math.max(...arrayKeys.map((k) => ((data as any)[k] as any[]).length));
      chartData = Array.from({ length }, (_, i) => {
        const item: any = {};
        arrayKeys.forEach((key) => {
          item[key] = (data as any)[key][i];
        });

        // Infer sensible defaults: label (name) and numeric (value)
        const numericKey = arrayKeys.find((k) => typeof (data as any)[k]?.[0] === 'number');
        const labelKey = arrayKeys.find((k) => typeof (data as any)[k]?.[0] !== 'number');
        if (labelKey !== undefined) item.name = item[labelKey];
        if (numericKey !== undefined) item.value = item[numericKey];
        return item;
      });
    }
  }
  
  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  switch (type.toLowerCase()) {
    case "line":
      return <LineChartViz data={chartData} config={config} />;
    case "bar":
      return <BarChartViz data={chartData} config={config} />;
    case "pie":
      return <PieChartViz data={chartData} config={config} />;
    case "area":
      return <AreaChartViz data={chartData} config={config} />;
    default:
      return (
        <div className="flex items-center justify-center h-64 bg-muted/50 rounded-lg">
          <p className="text-muted-foreground">Unsupported chart type: {type}</p>
        </div>
      );
  }
}
