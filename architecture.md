# Conversational RAG System for Project and Global Knowledge  
## **Final Technical Documentation — Implementation and Data Management Blueprint**

**Powered by Convex + @convex-dev/rag + OpenAI LLM + Agents API**

---

## 🧭 Cel systemu

Celem projektu jest stworzenie asystenta AI, który:
- prowadzi interaktywną rozmowę (chat) z użytkownikiem o projektach i aktach prawnych,  
- rozumie strukturę projektów i dokumentów (umowy, aneksy, oferty),  
- korzysta z wiedzy globalnej (akty prawne, przepisy),  
- działa iteracyjnie – potrafi dopytywać i potwierdzać kontekst,  
- generuje odpowiedzi poparte źródłami,  
- ma spójny cykl życia danych (CRUD + embedding) w Convexie.

---

## 🧱 Architektura systemu

```text
USER (Frontend Chat UI)
    │
    ▼
THREAD (Context Session)
    │
    ▼
Main LLM Agent (Reasoning Layer)
    │
    ├─► Intent classification (project/global)
    │
    ├─► [PROJECT PIPELINE]
    │        searchProjects  → RAG: projects
    │        searchDocuments → RAG: {project_rag_entry_id}_documents
    │        vectorSearch    → RAG: {document_rag_entry_id}_chunks
    │
    └─► [GLOBAL PIPELINE]
             searchGlobalKnowledge → RAG: global_docs
             vectorSearchGlobal    → RAG: {global_document_rag_entry_id}_chunks
             LLM synthesis
```

---

## ⚙️ Technologie

| Warstwa | Technologia |
|----------|--------------|
| Backend | Convex (serverless + DB) |
| Semantic Storage | `@convex-dev/rag` |
| LLM + Embeddings | `@ai-sdk/openai` |
| Frontend | React / Next.js / Cursor |
| Kontekst | Threads + Messages (Convex DB) |
| Monitoring | `rag_insights`, Convex Logs |

---

## 🧩 Warstwy danych

| Warstwa | Baza Convex | Namespace w RAG | Cel |
|----------|--------------|----------------|-----|
| Projekty | `projects` | `projects` | opisy projektów |
| Dokumenty (projektowe) | `project_documents` | `{project_rag_entry_id}_documents` | streszczenia, metadane |
| Treści (projektowe) | `project_documents` | `{document_rag_entry_id}_chunks` | fragmenty tekstu (chunki) |
| Wiedza globalna | `global_documents` | `global_docs` | katalog globalnych dokumentów |
| Treści globalne | `global_documents` | `{global_document_rag_entry_id}_chunks` | fragmenty tekstu (chunki) |

---

## 🧠 Trójwarstwowa architektura wiedzy

---

## 🚀 Cykl życia danych (CRUD + RAG)

### 1️⃣ CREATE / REPLACE (po nazwie pliku)

#### A. Utworzenie projektu

1. `projectId = db.insert("projects", { ... })`
2. `rag.add(namespace: "projects", text: ...) → entryId`
3. `db.patch(projectId, { rag_entry_id: entryId })`

#### B. Dodanie/aktualizacja dokumentu (projektowego) po nazwie pliku

1. Upsert `project_documents` (po indeksie `by_project_and_filename`).
2. `projectRagId = projects.rag_entry_id` (wymagany).
3. `rag.add(namespace: `${projectRagId}_documents`, text: meta+summary) → documentEntryId`
4. `db.patch(project_document._id, { rag_entry_id: documentEntryId })`
5. `rag.add(namespace: `${documentEntryId}_chunks`, text: fullText)`

#### C. Dodanie/aktualizacja dokumentu globalnego

1. Upsert `global_documents` (po indeksie `by_filename`).
2. `rag.add(namespace: "global_docs", text: meta+summary) → globalDocEntryId`
3. `db.patch(global_document._id, { rag_entry_id: globalDocEntryId })`
4. `rag.add(namespace: `${globalDocEntryId}_chunks`, text: fullText)`

---

## 🔍 Nazewnictwo namespace (źródła prawdy: rag_entry_id)
- Projekty: `projects`
- Dokumenty projektu: `{project_rag_entry_id}_documents`
- Chunki dokumentu: `{document_rag_entry_id}_chunks`
- Globalny katalog: `global_docs`
- Chunki globalnego dokumentu: `{global_document_rag_entry_id}_chunks`

---

## 🔧 Agent (narzędzia)
- `searchProjects(query)` → `projects`
- `searchProjectDocuments(projectId=project_rag_entry_id, query)` → `{project_rag_entry_id}_documents`
- `vectorSearchDocument(documentId=document_rag_entry_id, query)` → `{document_rag_entry_id}_chunks`
- `searchGlobalDocs(query)` → `global_docs`
- `vectorSearchGlobal(documentId=global_document_rag_entry_id, query)` → `{global_document_rag_entry_id}_chunks`

---

## 📊 Audyt i monitoring
Każda operacja embeddingu i search logowana w `rag_insights`.

---

## ✅ Status
- Convex DB schema: ✅
- CRUD + Embedding Sync: ✅
- RAG Namespaces: ✅ (oparte o `rag_entry_id`)
- Agent + Tools: ✅ (opisują rag_entry_id w namespace’ach)
- Threads + Context: ✅
- Audyt / Insights: ✅
- Skalowalność: ✅

---

## 💎 Wnioski końcowe
- Jeden komponent RAG – namespace oparte na `rag_entry_id` zapewniają jednoznaczność.
- Spójne tabele Convexa – przechowywanie `rag_entry_id` w `projects`, `project_documents`, `global_documents`.
- Narzędzia agenta odzwierciedlają architekturę (projekty → dokumenty → chunki / global → chunki).
- CRUD ↔ RAG w jednym cyklu, deterministyczne namespace’y.