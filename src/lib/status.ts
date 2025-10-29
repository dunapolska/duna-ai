export type DocStatus =
  | "pending"
  | "queued"
  | "uploading"
  | "uploaded"
  | "processing"
  | "done"
  | "error"
  | undefined;

export function statusLabel(s: DocStatus): string {
  switch (s) {
    case "pending": return "Oczekuje";
    case "queued": return "Oczekuje";
    case "uploading": return "Wysyłanie…";
    case "uploaded": return "Przesłano";
    case "processing": return "Przetwarzanie…";
    case "done": return "Gotowe";
    case "error": return "Błąd";
    default: return "Przetwarzanie…";
  }
}

export function statusVariant(s: DocStatus): "secondary" | "destructive" | "outline" {
  switch (s) {
    case "pending": return "secondary";
    case "queued": return "secondary";
    case "uploading": return "outline";
    case "uploaded": return "secondary";
    case "processing": return "outline";
    case "done": return "secondary";
    case "error": return "destructive";
    default: return "outline";
  }
}
