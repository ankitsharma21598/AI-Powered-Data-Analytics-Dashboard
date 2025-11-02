import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { datasetApi, insightApi } from "@/lib/api";
import { Database, Lightbulb, TrendingUp, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: datasetsResponse } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => datasetApi.getAll({ limit: 5 }),
  });

  const { data: insightsResponse } = useQuery({
    queryKey: ["insights"],
    queryFn: () => insightApi.getAll({ limit: 5 }),
  });

  const datasets = datasetsResponse?.data || [];
  const insights = insightsResponse?.data || [];

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
      value: datasets.filter((d) => d.metadata.processingStatus === "processing").length,
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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your data analytics.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="hover:shadow-lg transition-shadow">
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

        {/* Recent Datasets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Recent Datasets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {datasets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No datasets yet. Upload your first dataset to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {datasets.slice(0, 5).map((dataset) => (
                  <div
                    key={dataset._id}
                    onClick={() => navigate(`/datasets/${dataset._id}`)}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{dataset.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {dataset.rowCount} rows • {dataset.columns.length} columns
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          dataset.metadata.processingStatus === "completed"
                            ? "bg-chart-3/10 text-chart-3"
                            : dataset.metadata.processingStatus === "processing"
                            ? "bg-chart-4/10 text-chart-4"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {dataset.metadata.processingStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Recent Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No insights yet. Generate AI insights from your datasets!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {insights.slice(0, 5).map((insight) => (
                  <div
                    key={insight._id}
                    onClick={() => navigate(`/insights/${insight._id}`)}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {insight.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {insight.aiGenerated && (
                        <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent">
                          AI
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">
                        {insight.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
