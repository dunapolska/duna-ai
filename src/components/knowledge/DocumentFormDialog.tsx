"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import CreateProjectDialog from "@/components/knowledge/CreateProjectDialog";
import { statusLabel, type DocStatus } from "@/lib/status";

export type FileType = "global" | "project";

type ProjectItem = { _id: string; name: string };

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;

  // Scope
  fileType: FileType;
  setFileType: (t: FileType) => void;
  projects: ProjectItem[];
  selectedProject: string;
  setSelectedProject: (id: string) => void;
  onCreateProject: (name: string) => Promise<string>;

  // File selection
  onFilesSelected: (files: FileList | File[]) => Promise<void>;
  selectedFiles: Array<{ id: string; name: string; size: number; progress: number; state: string; error?: string }>;
  onStartUpload: () => Promise<void> | void;
  onRemoveFile: (id: string) => void;
};

export default function DocumentFormDialog(props: Props) {
  const {
    isOpen, onOpenChange, pending,
    fileType, setFileType,
    projects, selectedProject, setSelectedProject, onCreateProject,
    onFilesSelected,
    selectedFiles,
    onStartUpload,
    onRemoveFile,
  } = props;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [isContentEditorOpen, setIsContentEditorOpen] = useState(false);
  const [isContentPreviewOpen, setIsContentPreviewOpen] = useState(false);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await onFilesSelected(e.target.files);
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
    await onFilesSelected(e.dataTransfer.files);
  };

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    const id = await onCreateProject(newProjectName.trim());
    setSelectedProject(id);
    setFileType("project");
    setNewProjectName("");
    setIsAddProjectOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">Dodaj nowy plik</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Wybierz typ pliku i dodaj pliki. Pokażemy postęp uploadu poniżej.
          </DialogDescription>
        </DialogHeader>

        <div className={`py-4 space-y-6`}>
          <div>
            <Label className="text-sm font-medium mb-2 block text-popover-foreground">Typ pliku</Label>
            <div className="flex gap-2">
              <Button
                variant={fileType === "global" ? "default" : "outline"}
                onClick={() => setFileType("global")}
                className="flex-1"
              >
                Globalny
              </Button>
              <Button
                variant={fileType === "project" ? "default" : "outline"}
                onClick={() => setFileType("project")}
                className="flex-1"
              >
                Projektowy
              </Button>
            </div>
          </div>

          {fileType === "project" ? (
            <div>
              <Label htmlFor="modal-project" className="text-sm font-medium mb-2 block text-popover-foreground">
                Projekt
              </Label>
              <div className="flex gap-2 min-w-0 max-w-full">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger id="modal-project" className="bg-background border-border w-full min-w-0 flex-1 overflow-hidden">
                    <SelectValue placeholder="Wybierz projekt" className="truncate" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px]">
                    {projects.map((proj) => (
                      <SelectItem key={proj._id} value={proj._id} className="truncate px-4">
                        <span className="truncate">{proj.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <CreateProjectDialog
                    open={isAddProjectOpen}
                    onOpenChange={setIsAddProjectOpen}
                    onCreated={(id, name) => {
                      setSelectedProject(id);
                      setFileType("project");
                    }}
                  />
                </Dialog>
              </div>
            </div>
          ) : null}

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-lg p-8 transition-all ${
              isDragging ? "border-primary bg-primary/5 scale-[1.02]" : "border-border bg-background/50 hover:border-primary/50 hover:bg-background"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="modal-file-upload"
            />
            <div className="flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className={`p-3 rounded-full ${isDragging ? "bg-primary/20" : "bg-primary/10"}`}>
                <Upload className={`h-6 w-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-popover-foreground mb-1">
                  {isDragging ? "Upuść pliki tutaj" : "Przeciągnij i upuść pliki"}
                </p>
                <p className="text-xs text-muted-foreground">lub kliknij, aby wybrać pliki</p>
              </div>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              {selectedFiles.map((f) => (
                <div key={f.id} className="grid gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-popover-foreground truncate w-76">{f.name}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-muted-foreground ml-2 shrink-0">{(f.size / (1024 * 1024)).toFixed(2)} MB</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Usuń plik z kolejki"
                        onClick={() => onRemoveFile(f.id)}
                        disabled={pending || f.progress > 0 && f.progress < 100 || f.state === "uploading"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Progress value={Math.max(0, Math.min(100, Math.round(f.progress)))} />
                  <div className="text-xs text-muted-foreground">
                    {statusLabel(f.state as DocStatus)}{f.error ? ` • ${f.error}...` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={() => onStartUpload()} disabled={pending || selectedFiles.length === 0}>Wyślij</Button>
        </DialogFooter>
      </DialogContent>

      

    </Dialog>
  );
}


