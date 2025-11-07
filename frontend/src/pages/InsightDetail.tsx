import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { insightApi } from "@/lib/api";
import {
  ArrowLeft,
  Trash2,
  TrendingUp,
  Sparkles,
  Calendar,
  BarChart,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChartRenderer } from "@/components/charts/ChartRenderer";

export default function InsightDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: insightResponse, isLoading } = useQuery({
    queryKey: ["insight", id],
    queryFn: () => insightApi.getById(id!),
    enabled: !!id,
  });

  const insight = insightResponse?.data;

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-24" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-16" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!insight) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Insight not found</p>
          <Button onClick={() => navigate("/insights")} className="mt-4">
            Back to Insights
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/insights")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold">{insight.title}</h1>
                {insight.aiGenerated && (
                  <Badge variant="default" className="gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI Generated
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mb-2">
                {insight.description}
              </p>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(insight.createdAt).toLocaleDateString()}
                </span>
                {insight.aiModel && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-4 w-4" />
                    {insight.aiModel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Are you sure you want to delete this insight?")) {
                insightApi.delete(insight._id).then(() => {
                  toast.success("Insight deleted");
                  navigate("/insights");
                });
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Type
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold capitalize">
                {insight.type}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Confidence
              </CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {Math.round((insight.confidence || 0) * 100)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Visualizations
              </CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {insight.visualizations.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="metrics" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="mt-4">
            {insight.metrics && insight.metrics.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Key Performance Metrics</CardTitle>
                  <CardDescription>
                    Important metrics and measurements from the analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {insight.metrics.map((metric, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border"
                      >
                        <div className="p-3 bg-primary/10 rounded-full">
                          <TrendingUp className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground">
                            {metric.name}
                          </p>
                          <p className="text-2xl font-bold">
                            {metric.value}
                            {metric.unit && (
                              <span className="text-sm ml-1">
                                {metric.unit}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No metrics available for this insight</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="visualizations" className="mt-4">
            {insight.visualizations && insight.visualizations.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Data Visualizations</CardTitle>
                  <CardDescription>
                    Charts and graphs generated from the analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {insight.visualizations.map((viz, index) => (
                      <AccordionItem key={index} value={`viz-${index}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <BarChart className="h-4 w-4" />
                            <span className="font-semibold capitalize">
                              {viz.type} Chart
                            </span>
                            <Badge variant="outline" className="ml-2">
                              Visualization {index + 1}
                            </Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="p-4 bg-muted rounded-lg mt-2">
                            {/* <pre className="text-xs overflow-x-auto">
                              {JSON.stringify(viz.data, null, 2)}
                              {JSON.stringify(viz.config, null, 2)}
                              {JSON.stringify(viz.type, null, 2)}
                            </pre> */}
                            <ChartRenderer
                              type={viz.type}
                              data={viz.data}
                              config={viz.config}
                            />
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No visualizations available for this insight</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="mt-4">
            {insight.recommendations && insight.recommendations.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Actionable Recommendations</CardTitle>
                  <CardDescription>
                    Suggested actions based on the analysis results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {insight.recommendations.map((rec, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                            {index + 1}
                          </div>
                        </div>
                        <span className="flex-1 text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recommendations available for this insight</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Query Section if available */}
        {insight.query && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Query</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm italic">&ldquo;{insight.query}&rdquo;</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
