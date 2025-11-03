import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { datasetApi, uploadApi } from "@/lib/api";
import { Upload, Search, Database, Trash2, Download, Eye } from "lucide-react";
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

export default function Datasets() {
  const [search, setSearch] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: datasetsResponse, isLoading } = useQuery({
    queryKey: ["datasets", search],
    queryFn: () => datasetApi.getAll({ search, limit: 50 }),
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { file: File; name?: string; description?: string }) =>
      uploadApi.upload(data.file, data.name, data.description),
    onSuccess: () => {
      toast.success("Dataset uploaded successfully!");
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setUploadDialogOpen(false);
      setFile(null);
      setName("");
      setDescription("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to upload dataset");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => datasetApi.delete(id),
    onSuccess: () => {
      toast.success("Dataset deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete dataset");
    },
  });

  const handleUpload = () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    uploadMutation.mutate({ file, name, description });
  };

  const datasets = datasetsResponse?.data || [];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Datasets</h1>
            <p className="text-muted-foreground">
              Manage and explore your data files
            </p>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Dataset
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload New Dataset</DialogTitle>
                <DialogDescription>
                  Upload CSV, JSON, or Excel files (max 10MB)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="file">File *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.json,.xlsx,.xls"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Dataset Name (Optional)</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Dataset"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Dataset description"
                  />
                </div>
                <Button
                  onClick={handleUpload}
                  className="w-full"
                  disabled={uploadMutation.isPending || !file}
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search datasets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Datasets Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading datasets...</p>
          </div>
        ) : datasets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No datasets found</h3>
              <p className="text-muted-foreground mb-4 text-center">
                Upload your first dataset to start analyzing data
              </p>
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Dataset
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {datasets.map((dataset) => (
              <Card
                key={dataset._id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{dataset.name}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        dataset.metadata.processingStatus === "completed"
                          ? "bg-chart-3/10 text-chart-3"
                          : dataset.metadata.processingStatus === "processing"
                          ? "bg-chart-4/10 text-chart-4"
                          : dataset.metadata.processingStatus === "failed"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {dataset.metadata.processingStatus}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {dataset.description || "No description"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      {dataset.rowCount} rows
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">
                      {dataset.columns.length} columns
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted capitalize">
                      {dataset.fileType}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => navigate(`/datasets/${dataset._id}`)}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => datasetApi.download(dataset._id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (
                          confirm(
                            "Are you sure you want to delete this dataset?"
                          )
                        ) {
                          deleteMutation.mutate(dataset._id);
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
