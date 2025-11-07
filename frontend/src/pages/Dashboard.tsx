import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { datasetApi, insightApi } from "@/lib/api";
import {
  Database,
  Lightbulb,
  TrendingUp,
  Clock,
  Activity,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LineChartViz } from "@/components/charts/LineChartViz";
import { BarChartViz } from "@/components/charts/BarChartViz";

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: datasetsResponse, isLoading: datasetsLoading } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => datasetApi.getAll({ limit: 5 }),
  });

  const { data: insightsResponse, isLoading: insightsLoading } = useQuery({
    queryKey: ["insights"],
    queryFn: () => insightApi.getAll({ limit: 5 }),
  });

  const datasets = datasetsResponse?.data || [];
  const insights = insightsResponse?.data || [];
  const completedDatasets = datasets.filter(
    (d) => d.metadata.processingStatus === "completed"
  ).length;
  const processingDatasets = datasets.filter(
    (d) => d.metadata.processingStatus === "processing"
  ).length;
  const processingProgress =
    datasets.length > 0 ? (completedDatasets / datasets.length) * 100 : 0;

  // Sample data for overview charts
  const activityData = [
    { name: "Mon", datasets: 4, insights: 2 },
    { name: "Tue", datasets: 3, insights: 5 },
    { name: "Wed", datasets: 6, insights: 3 },
    { name: "Thu", datasets: 2, insights: 4 },
    { name: "Fri", datasets: 5, insights: 6 },
    { name: "Sat", datasets: 1, insights: 2 },
    { name: "Sun", datasets: 3, insights: 3 },
  ];

  const insightTypeData = insights.reduce((acc, insight) => {
    const existing = acc.find((item) => item.name === insight.type);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: insight.type, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const stats = [
    {
      title: "Total Datasets",
      value: datasetsResponse?.total || 0,
      icon: Database,
      description: "Uploaded datasets",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "AI Insights",
      value: insights.filter((i) => i.aiGenerated).length,
      icon: Lightbulb,
      description: "Generated insights",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Active Processing",
      value: processingDatasets,
      icon: TrendingUp,
      description: "In progress",
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      title: "Recent Activity",
      value: datasets.length + insights.length,
      icon: Clock,
      description: "Last 7 days",
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your data analytics.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.title}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`${stat.bgColor} p-2 rounded-lg`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Processing Overview
              </CardTitle>
              <CardDescription>
                Track your data processing progress
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Completion Rate</span>
                  <span className="text-sm text-muted-foreground">
                    {completedDatasets}/{datasets.length} completed
                  </span>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {datasets.length} Total
                </Badge>
                <Badge variant="default" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {completedDatasets} Ready
                </Badge>
                {processingDatasets > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {processingDatasets} Processing
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {insightTypeData.length > 0 && (
            <BarChartViz
              data={insightTypeData}
              config={{
                title: "Insights by Type",
                description: "Distribution of insight types",
                xKey: "name",
                bars: [
                  {
                    dataKey: "value",
                    fill: "hsl(var(--primary))",
                    name: "Count",
                  },
                ],
              }}
            />
          )}
        </div>

        {datasets.length > 0 && (
          <LineChartViz
            data={activityData}
            config={{
              title: "Weekly Activity Overview",
              description: "Dataset uploads and insights generated this week",
              xKey: "name",
              lines: [
                {
                  dataKey: "datasets",
                  stroke: "#8884d8",
                  name: "Datasets",
                },
                { dataKey: "insights", stroke: "#82ca9d", name: "Insights" },
              ],
            }}
          />
        )}

        <Tabs defaultValue="datasets" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="datasets" className="gap-2">
              <Database className="h-4 w-4" />
              Recent Datasets
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Recent Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="datasets" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {datasetsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                      </div>
                    ))}
                  </div>
                ) : datasets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>
                      No datasets yet. Upload your first dataset to get started!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {datasets.map((dataset) => (
                      <Tooltip key={dataset._id}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => navigate(`/datasets/${dataset._id}`)}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-all hover:shadow-md"
                          >
                            <div className="flex-1">
                              <h4 className="font-medium">{dataset.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {dataset.rowCount} rows •{" "}
                                {dataset.columns.length} columns
                              </p>
                            </div>
                            <Badge
                              variant={
                                dataset.metadata.processingStatus ===
                                "completed"
                                  ? "default"
                                  : dataset.metadata.processingStatus ===
                                    "processing"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {dataset.metadata.processingStatus}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Click to view details</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                {insightsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                        <Skeleton className="h-6 w-16" />
                      </div>
                    ))}
                  </div>
                ) : insights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>
                      No insights yet. Generate AI insights from your datasets!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {insights.map((insight) => (
                      <Tooltip key={insight._id}>
                        <TooltipTrigger asChild>
                          <div
                            onClick={() => navigate(`/insights/${insight._id}`)}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-all hover:shadow-md"
                          >
                            <div className="flex-1">
                              <h4 className="font-medium flex items-center gap-2">
                                {insight.title}
                                {insight.aiGenerated && (
                                  <Badge variant="outline" className="text-xs">
                                    AI
                                  </Badge>
                                )}
                              </h4>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {insight.description}
                              </p>
                            </div>
                            <Badge variant="secondary" className="capitalize">
                              {insight.type}
                            </Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Click to view details</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
