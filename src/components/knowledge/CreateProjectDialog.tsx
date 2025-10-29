"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (projectId: string, name: string) => void;
};

export default function CreateProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const createProject = useMutation(api.projects.create);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contractor, setContractor] = useState("");

  const nameOk = name.trim().length > 0;
  const descOk = description.trim().length > 0;
  const contractorOk = contractor.trim().length > 0;

  const submit = async () => {
    if (!nameOk || !descOk || !contractorOk) return;
    try {
      setPending(true);
      const res = await createProject({ name: name.trim(), description: description.trim(), contractor: contractor.trim() });
      const createdName = name.trim();
      onOpenChange(false);
      setName("");
      setDescription("");
      setContractor("");
      if (onCreated) onCreated((res as any).projectId as string, createdName);
      // success toast po utworzeniu (indeksacja RAG działa w tle na serwerze)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { toast } = await import("sonner");
      toast.success("Projekt dodany", { description: "Projekt został dodany." });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">Nowy projekt</DialogTitle>
          <DialogDescription className="text-muted-foreground">Uzupełnij wymagane dane projektu</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>
              Nazwa <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nazwa projektu"
              required
              aria-invalid={!nameOk}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>
              Opis <span className="text-destructive">*</span>
            </Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis"
              required
              aria-invalid={!descOk}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>
              Kontrahent <span className="text-destructive">*</span>
            </Label>
            <Input
              value={contractor}
              onChange={(e) => setContractor(e.target.value)} 
              placeholder="Nazwa kontrahenta" 
              required
              aria-invalid={!contractorOk}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Anuluj</Button>
          <Button onClick={submit} disabled={pending || !nameOk || !descOk || !contractorOk}>Utwórz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
