import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { insightApi, datasetApi } from "@/lib/api";
import {
  Lightbulb,
  Search,
  Sparkles,
  Trash2,
  Eye,
  Copy,
  TrendingUp,
  BarChart,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Insights() {
  const [search, setSearch] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [query, setQuery] = useState("");
  const [insightType, setInsightType] = useState("trend");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [insightToDelete, setInsightToDelete] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: insightsResponse, isLoading } = useQuery({
    queryKey: ["insights", search],
    queryFn: () => insightApi.getAll({ search, limit: 50 }),
  });

  const { data: datasetsResponse } = useQuery({
    queryKey: ["datasets"],
    queryFn: () => datasetApi.getAll({ limit: 100 }),
  });

  const generateMutation = useMutation({
    mutationFn: (data: { datasetId: string; query?: string; type?: string }) =>
      insightApi.generate(data.datasetId, data.query, data.type),
    onSuccess: () => {
      toast.success("AI Insight generated successfully!");
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      setGenerateDialogOpen(false);
      setSelectedDataset("");
      setQuery("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate insight");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => insightApi.delete(id),
    onSuccess: () => {
      toast.success("Insight deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      setDeleteDialogOpen(false);
      setInsightToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete insight");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => insightApi.duplicate(id),
    onSuccess: () => {
      toast.success("Insight duplicated successfully!");
      queryClient.invalidateQueries({ queryKey: ["insights"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to duplicate insight");
    },
  });

  const handleGenerate = () => {
    if (!selectedDataset) {
      toast.error("Please select a dataset");
      return;
    }
    generateMutation.mutate({
      datasetId: selectedDataset,
      query: query || undefined,
      type: insightType,
    });
  };

  const insights = insightsResponse?.data || [];
  const datasets = datasetsResponse?.data || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Insights</h1>
            <p className="text-muted-foreground">
              AI-powered insights from your data
            </p>
          </div>
          <Dialog
            open={generateDialogOpen}
            onOpenChange={setGenerateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate AI Insight
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate AI Insight</DialogTitle>
                <DialogDescription>
                  Let AI analyze your dataset and generate insights
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="dataset">Select Dataset *</Label>
                  <Select
                    value={selectedDataset}
                    onValueChange={setSelectedDataset}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets
                        .filter(
                          (d) => d.metadata.processingStatus === "completed"
                        )
                        .map((dataset) => (
                          <SelectItem key={dataset._id} value={dataset._id}>
                            {dataset.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Insight Type</Label>
                  <Select value={insightType} onValueChange={setInsightType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trend">Trend Analysis</SelectItem>
                      <SelectItem value="anomaly">Anomaly Detection</SelectItem>
                      <SelectItem value="correlation">Correlation</SelectItem>
                      <SelectItem value="prediction">Prediction</SelectItem>
                      <SelectItem value="summary">Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="query">Query (Optional)</Label>
                  <Input
                    id="query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="What trends do you see?"
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  className="w-full"
                  disabled={generateMutation.isPending || !selectedDataset}
                >
                  {generateMutation.isPending
                    ? "Generating..."
                    : "Generate Insight"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search insights..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Insights Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 flex-1" />
                    <Skeleton className="h-9 w-9" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : insights.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No insights yet</h3>
              <p className="text-muted-foreground mb-4 text-center">
                Generate AI insights from your datasets to discover trends and
                patterns
              </p>
              <Button
                onClick={() => setGenerateDialogOpen(true)}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate AI Insight
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {insights.map((insight) => (
              <Card
                key={insight._id}
                className="hover:shadow-lg transition-all group"
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate flex items-center gap-2">
                          {insight.title}
                          {insight.aiGenerated && (
                            <Sparkles className="h-4 w-4 text-accent flex-shrink-0" />
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{insight.title}</TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {insight.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="capitalize gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {insight.type}
                    </Badge>
                    {insight.confidence && (
                      <Badge variant="outline">
                        {Math.round(insight.confidence * 100)}% confidence
                      </Badge>
                    )}
                    {insight.visualizations.length > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <BarChart className="h-3 w-3" />
                        {insight.visualizations.length}
                      </Badge>
                    )}
                  </div>
                  {insight.metrics && insight.metrics.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">
                        {insight.metrics.length}
                      </span>{" "}
                      key metrics
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => navigate(`/insights/${insight._id}`)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View insight details</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => duplicateMutation.mutate(insight._id)}
                        disabled={duplicateMutation.isPending}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate insight</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setInsightToDelete(insight._id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete insight</TooltipContent>
                  </Tooltip>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Insight?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                insight.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (insightToDelete) {
                    deleteMutation.mutate(insightToDelete);
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
