import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { insightApi, datasetApi } from "@/lib/api";
import { Lightbulb, Search, Sparkles, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
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
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete insight");
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
          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
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
                  <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets
                        .filter((d) => d.metadata.processingStatus === "completed")
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
                  {generateMutation.isPending ? "Generating..." : "Generate Insight"}
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
          <div className="text-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading insights...</p>
          </div>
        ) : insights.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No insights yet</h3>
              <p className="text-muted-foreground mb-4 text-center">
                Generate AI insights from your datasets to discover trends and patterns
              </p>
              <Button onClick={() => setGenerateDialogOpen(true)} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate AI Insight
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {insights.map((insight) => (
              <Card key={insight._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{insight.title}</span>
                    {insight.aiGenerated && (
                      <Sparkles className="h-4 w-4 text-accent" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {insight.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary capitalize">
                      {insight.type}
                    </span>
                    {insight.confidence && (
                      <span className="text-xs px-2 py-1 rounded-full bg-muted">
                        {Math.round(insight.confidence * 100)}% confidence
                      </span>
                    )}
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      {insight.visualizations.length} charts
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => navigate(`/insights/${insight._id}`)}
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this insight?")) {
                          deleteMutation.mutate(insight._id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
