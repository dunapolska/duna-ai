"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Trash2, Download, Upload } from "lucide-react";
import DocumentFormDialog, { type FileType } from "@/components/knowledge/DocumentFormDialog";
import { statusLabel, statusVariant } from "@/lib/status";
import { Badge } from "@/components/ui/badge";
import { useCallback } from "react";

const categories = ["Akt prawny", "Rozporządzenie", "Ustawa", "Zarządzenie", "Inne"];

export default function KnowledgePage() {
  // Scope / projects
  const projects = useQuery(api.projects.list) ?? [];
  const createProject = useMutation(api.projects.create);

  // Upload mutations
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const registerUpload = useMutation(api.uploads.registerUpload);
  const globalDocs = useQuery(api.documents.listGlobal) ?? [];
  const allProjectDocs = useQuery(api.documents.listAllProjectDocs) ?? [];
  const deleteDocument = useMutation(api.documents.deleteDocument);
  const [page, setPage] = useState<any>(null);

  // Dialogs and form states
  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFilesState, setSelectedFilesState] = useState<Array<{ id: string; file: File; name: string; size: number; progress: number; state: string; error?: string }>>([]);

  const [fileType, setFileType] = useState<FileType>("global");
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]);
  const [selectedProject, setSelectedProject] = useState<string>("");

  const [docText, setDocText] = useState("");
  const [docFilename, setDocFilename] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("");
  const [docNumber, setDocNumber] = useState("");

  const [newProjectName, setNewProjectName] = useState("");

  // Dropzone
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // No client-side parsing or listing via RAG here

  function resetDocForm() {
    setDocText("");
    setDocFilename("");
    setDocTitle("");
    setDocType("");
    setDocNumber("");
    
    setFileType("global");
    setSelectedCategory(categories[0]);
    setSelectedProject(projects[0]?._id ?? "");
  }

  const openAddDialog = () => {
    resetDocForm();
    setIsAddFileOpen(true);
  };

  async function processFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    const existingNames = new Set(selectedFilesState.map((f) => f.name.toLowerCase()));
    const toAdd: Array<File> = [];
    const duplicates: Array<string> = [];
    for (const f of incoming) {
      const key = f.name.toLowerCase();
      const alreadyInBatch = toAdd.some((x) => x.name.toLowerCase() === key);
      if (existingNames.has(key) || alreadyInBatch) {
        duplicates.push(f.name);
      } else {
        toAdd.push(f);
      }
    }
    if (duplicates.length > 0) {
      const { toast } = await import("sonner");
      const shown = duplicates.slice(0, 3).join(", ");
      toast.info("Pominięto duplikaty", {
        description: `${duplicates.length} plików o tej samej nazwie: ${shown}${duplicates.length > 3 ? "…" : ""}`,
        className: "bg-blue-50 text-blue-900 border border-blue-200",
      });
    }
    if (toAdd.length === 0) return;
    const newItems = toAdd.map((f) => ({ id: `${Date.now()}_${f.name}_${Math.random().toString(36).slice(2)}`, file: f, name: f.name, size: f.size, progress: 0, state: "queued" }));
    setSelectedFilesState((prev) => [...prev, ...newItems]);
  }

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await processFiles(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await processFiles(e.dataTransfer.files);
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    const res = await createProject({ name: newProjectName.trim() });
    setNewProjectName("");
    setIsAddProjectOpen(false);
    setSelectedProject((res as any).projectId as string);
    setFileType("project");
  };


  const onStartUpload = async () => {
    setPending(true);
    const concurrency = 5;
    const queue = selectedFilesState.filter((i) => i.state === "queued" || i.state === "error");
    let idx = 0;
    let uploadedCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    const uploadNext = async () => {
      if (idx >= queue.length) return;
      const item = queue[idx++];
      setSelectedFilesState((prev) => prev.map((p) => (p.id === item.id ? { ...p, state: "uploading", progress: 0, error: undefined } : p)));
      try {
        const { url } = await generateUploadUrl({});
        await new Promise<void>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url);
          xhr.setRequestHeader("Content-Type", item.file.type);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const pct = (ev.loaded / ev.total) * 100;
              setSelectedFilesState((prev) => prev.map((p) => (p.id === item.id ? { ...p, progress: pct } : p)));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText || "{}");
                const storageId = data.storageId;
                if (!storageId) throw new Error("Brak storageId");
                registerUpload({
                  storageId,
                  filename: item.file.name,
                  mimeType: item.file.type,
                  category: fileType === "project" ? "project" : "global",
                  projectId: fileType === "project" ? (selectedProject as any) : undefined,
                })
                  .then(() => {
                    setSelectedFilesState((prev) => prev.map((p) => (p.id === item.id ? { ...p, state: "uploaded", progress: 100 } : p)));
                    uploadedCount += 1;
                    resolve();
                  })
                  .catch((e) => {
                    setSelectedFilesState((prev) => prev.map((p) => (p.id === item.id ? { ...p, state: "error", error: e?.message ?? String(e) } : p)));
                    failedCount += 1;
                    resolve();
                  });
              } catch (e: any) {
                setSelectedFilesState((prev) => prev.map((p) => (p.id === item.id ? { ...p, state: "error", error: e?.message ?? String(e) } : p)));
                failedCount += 1;
                resolve();
              }
            } else {
              setSelectedFilesState((prev) => prev.map((p) => (p.id === item.id ? { ...p, state: "error", error: `HTTP ${xhr.status}` } : p)));
              failedCount += 1;
              resolve();
            }
          };
          xhr.onerror = () => {
            setSelectedFilesState((prev) => prev.map((p) => (p.id === item.id ? { ...p, state: "error", error: "Błąd sieci" } : p)));
            failedCount += 1;
            resolve();
          };
          xhr.send(item.file);
        });
      } finally {
        if (idx < queue.length) await uploadNext();
      }
    };
    const starters = Array.from({ length: Math.min(concurrency, queue.length) }, () => uploadNext());
    await Promise.all(starters);
    try {
      // @ts-ignore
      const { toast } = await import("sonner");
      if (uploadedCount > 0 && failedCount === 0) {
        toast.success("Pliki przesłane", { 
          description: `${uploadedCount} plików zostało pomyślnie przesłanych i jest przetwarzanych w tle. Duplikaty zostały automatycznie wykryte.`,
          className: "bg-emerald-50 text-emerald-900 border border-emerald-200"
        });
      } else if (uploadedCount > 0 && failedCount > 0) {
        toast.warning("Upload zakończony z błędami", { 
          description: `${uploadedCount} plików przesłano, ${failedCount} nie powiodło się. Duplikaty zostały automatycznie wykryte.`,
          className: "bg-orange-50 text-orange-900 border border-orange-200"
        });
      } else {
        toast.error("Upload nie powiódł się", { 
          description: `${failedCount} plików nie zostało przesłanych.`,
          className: "bg-red-50 text-red-900 border border-red-200"
        });
      }
      setIsAddFileOpen(false);
      setSelectedFilesState([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Zarządzanie plikami</h1>
        <p className="text-muted-foreground">Organizuj i zarządzaj plikami globalnymi oraz projektowymi</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-foreground">Wszystkie pliki ({globalDocs.length + allProjectDocs.length})</h2>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          Dodaj plik
        </Button>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-foreground">Dokumenty globalne</h3>
          {globalDocs.length > 0 ? (
            <div className="grid gap-3">
              {globalDocs.map((d: any) => (
                <Card key={d._id} className="p-4 bg-card border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">{d.title || d.filename}</div>
                      <div className="text-sm text-muted-foreground">{d.type ?? "–"} {d.document_number ? `• ${d.document_number}` : ""}</div>
                      <div className="text-xs mt-1 flex items-center gap-2">
                        <Badge variant={statusVariant(d.status)} className="text-xs">
                          {statusLabel(d.status)}
                        </Badge>
                        {d.error && <span className="text-destructive">• błąd: {d.error}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Usuń dokument"
                        onClick={async () => {
                          try {
                            // optimistic UI – brak lokalnej listy, rely on revalidate by Convex SSR/stream
                            await deleteDocument({ documentId: d._id });
                            const { toast } = await import("sonner");
                            toast.success("Usunięto dokument", { className: "bg-emerald-50 text-emerald-900 border border-emerald-200" });
                          } catch (e: any) {
                            const { toast } = await import("sonner");
                            toast.error("Nie udało się usunąć dokumentu", { description: e?.message ?? String(e) });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center bg-card border-border">
              <p className="text-muted-foreground">Brak dokumentów globalnych</p>
            </Card>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2 text-foreground">Dokumenty projektowe</h3>
          {allProjectDocs.length > 0 ? (
            <div className="grid gap-3">
              {allProjectDocs.map((d: any) => (
                <Card key={d._id} className="p-4 bg-card border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">{d.title || d.filename}</div>
                      <div className="text-sm text-muted-foreground">{projects.find((p: any) => p._id === d.project_id)?.name ?? "Projekt"} • {d.type ?? "–"} {d.document_number ? `• ${d.document_number}` : ""}</div>
                      <div className="text-xs mt-1 flex items-center gap-2">
                        <Badge variant={statusVariant(d.status)} className="text-xs">
                          {statusLabel(d.status)}
                        </Badge>
                        {d.error && <span className="text-destructive">• błąd: {d.error}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Usuń dokument"
                        onClick={async () => {
                          try {
                            await deleteDocument({ documentId: d._id });
                            const { toast } = await import("sonner");
                            toast.success("Usunięto dokument", { className: "bg-emerald-50 text-emerald-900 border border-emerald-200" });
                          } catch (e: any) {
                            const { toast } = await import("sonner");
                            toast.error("Nie udało się usunąć dokumentu", { description: e?.message ?? String(e) });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center bg-card border-border">
              <p className="text-muted-foreground">Brak dokumentów projektowych</p>
            </Card>
          )}
        </div>
      </div>

      <DocumentFormDialog
        isOpen={isAddFileOpen}
        onOpenChange={setIsAddFileOpen}
        pending={pending}
        fileType={fileType}
        setFileType={setFileType}
        projects={projects as any}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        onCreateProject={async (name) => {
          const res = await createProject({ name });
          return (res as any).projectId as string;
        }}
        onFilesSelected={processFiles}
        selectedFiles={selectedFilesState.map(({ id, name, size, progress, state, error }) => ({ id, name, size, progress, state, error }))}
        onStartUpload={onStartUpload}
        onRemoveFile={(id) => {
          setSelectedFilesState((prev) => prev.filter((p) => p.id !== id));
        }}
      />
    </div>
  );
}


