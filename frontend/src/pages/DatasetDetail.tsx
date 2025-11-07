import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { datasetApi } from "@/lib/api";
import { ArrowLeft, Download, Trash2, FileText, Database, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DatasetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: datasetResponse, isLoading } = useQuery({
    queryKey: ["dataset", id],
    queryFn: () => datasetApi.getById(id!),
    enabled: !!id,
  });

  const { data: previewResponse } = useQuery({
    queryKey: ["dataset-preview", id],
    queryFn: () => datasetApi.getPreview(id!),
    enabled: !!id,
  });

  const dataset = datasetResponse?.data;
  const preview = previewResponse?.data;

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-1/3" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-4 w-16" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-20" /></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!dataset) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Dataset not found</p>
          <Button onClick={() => navigate("/datasets")} className="mt-4">Back to Datasets</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/datasets")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold">{dataset.name}</h1>
                <Badge variant={dataset.metadata.processingStatus === "completed" ? "default" : "secondary"}>
                  {dataset.metadata.processingStatus}
                </Badge>
              </div>
              <p className="text-muted-foreground">{dataset.description || "No description"}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(dataset.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => datasetApi.download(dataset._id)} className="gap-2">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              if (confirm("Delete this dataset?")) {
                datasetApi.delete(dataset._id).then(() => {
                  toast.success("Dataset deleted");
                  navigate("/datasets");
                });
              }
            }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Rows</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{dataset.rowCount.toLocaleString()}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Columns</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{dataset.columns.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">File Type</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold capitalize">{dataset.fileType}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Size</CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{(dataset.fileSize / 1024 / 1024).toFixed(2)} MB</div></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="columns">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="columns">Columns</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="columns" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Schema</CardTitle>
                <CardDescription>Column information and data types</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Nullable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataset.columns.map((col, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{col.name}</TableCell>
                        <TableCell><Badge variant="outline">{col.type}</Badge></TableCell>
                        <TableCell><Badge variant={col.nullable ? "secondary" : "default"}>{col.nullable ? "Yes" : "No"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            {preview && preview.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Data Preview</CardTitle>
                  <CardDescription>First 10 rows</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(preview[0]).map((key) => <TableHead key={key}>{key}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row).map((val: any, j) => <TableCell key={j}>{val?.toString() || "N/A"}</TableCell>)}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No preview available</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
