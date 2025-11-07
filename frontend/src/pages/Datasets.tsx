import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { datasetApi, uploadApi } from "@/lib/api";
import { Upload, Search, Database, Trash2, Download, Eye, FileText, Copy } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
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

export default function Datasets() {
  const [search, setSearch] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [datasetToDelete, setDatasetToDelete] = useState<string | null>(null);
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
      setDeleteDialogOpen(false);
      setDatasetToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete dataset");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => datasetApi.duplicate(id),
    onSuccess: () => {
      toast.success("Dataset duplicated successfully!");
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to duplicate dataset");
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-9 flex-1" />
                    <Skeleton className="h-9 w-9" />
                    <Skeleton className="h-9 w-9" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : datasets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No datasets found</h3>
              <p className="text-muted-foreground mb-4 text-center">
                Upload your first dataset to start analyzing data
              </p>
              <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Dataset
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {datasets.map((dataset) => (
              <Card key={dataset._id} className="hover:shadow-lg transition-all group">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate">{dataset.name}</span>
                      </TooltipTrigger>
                      <TooltipContent>{dataset.name}</TooltipContent>
                    </Tooltip>
                    <Badge
                      variant={
                        dataset.metadata.processingStatus === "completed"
                          ? "default"
                          : dataset.metadata.processingStatus === "processing"
                          ? "secondary"
                          : dataset.metadata.processingStatus === "failed"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {dataset.metadata.processingStatus}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {dataset.description || "No description provided"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dataset.metadata.processingStatus === "processing" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Processing...</span>
                      </div>
                      <Progress value={50} className="h-1" />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1">
                      <FileText className="h-3 w-3" />
                      {dataset.rowCount.toLocaleString()} rows
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Database className="h-3 w-3" />
                      {dataset.columns.length} cols
                    </Badge>
                    <Badge variant="outline" className="capitalize gap-1">
                      {dataset.fileType}
                    </Badge>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => navigate(`/datasets/${dataset._id}`)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View dataset details</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => duplicateMutation.mutate(dataset._id)}
                        disabled={duplicateMutation.isPending}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate dataset</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => datasetApi.download(dataset._id)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download dataset</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDatasetToDelete(dataset._id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete dataset</TooltipContent>
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
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the dataset
                and all associated insights.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (datasetToDelete) {
                    deleteMutation.mutate(datasetToDelete);
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
