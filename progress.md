## Postęp prac

### Zrealizowane dziś
- Schemat Convex: dodane tabele, relacje i indeksy (w tym `global_documents.by_filename`, `project_documents.by_project_and_filename`).
- Indeksacja RAG: projekty (`projects_index`), dokumenty projektowe (`project_{projectId}_documents`), chunki dokumentów (`document_{documentId}_chunks`), globalne (`global_docs`, `global_{documentId}_chunks`).
- Preprocessing (Convex action): ekstrakcja `title`, `type`, `document_number` z pierwszej części treści.
- Ingest (Convex actions): `upsertByFilename`, `upsertGlobalByFilename` – zapis do DB, streszczenie (5 zdań), indeksacja do RAG.
- RAG config: domyślny próg wyszukiwania 0.3, czyszczenie (`rag.clearAll`), filtry tymczasowo wyłączone w `ingest` (stabilizacja).
- UI Knowledge: dodawanie dokumentu (global/projekt) z toastami; sekcje list: globalne i projektowe (z DB).

### Uwagi techniczne
- Chunkowanie realizuje RAG (wysyłamy pełny `text` per dokument do przestrzeni chunków).
- Streszczenie generowane przed embedowaniem i zapisywane do `project_documents.summary`.
- Projekty indeksowane w tle po utworzeniu; dodano podstawowe słowa kluczowe (dla dróg) w opisie projektu.

### Do zrobienia (kolejne kroki)
- Przywrócić `filterValues` po redeployu (uzgodnić stały zestaw nazw, np. `category`, `contentType`).
- UI: podgląd wyników RAG per dokument (np. szybki search w `document_{id}_chunks`).
- Ewentualne token-based chunkowanie klientowe (opcjonalnie), jeśli zajdzie potrzeba precyzyjnej kontroli.