1. Musimy wdrożyć OCR, który będzie odczytywał rózne formaty plików. Np. pdf który nie jest tekstem, a przekonwertowanym zdjęciem, albo xlsx.:
2. Przy wrzucaniu dokumentów potrzebujemy mieć oryginalną nazwę pliku jako tytuł
3. Potrzebujemy zmienić proces indeksowania pliku
    1. Wrzucenie jednego pliku bądź wielu na raz
    2. Umieszczenie ich w convex storage
    3. Uruchomienie background jobów, które zrobią OCR pliku, a następie zaindeksują zgodnie z procesem który działa obecnie.
    4. Na frontendzie powinna być lista informująca o statusie przetwarzania danego pliku.
4. Musimy dodać opcję usuwania plików zarówno z db jak i z rag. Na poziomie tabel project_documents i global_docs jest rag_entry_id, które prowadzi do tego. Na backendzie powinno zadziać się: OCR, wstępne przetworzenie pliku, okreslenie jego atrybutów, a następnie indeksacja i wszystkie obecne procesy
5. Do wdrożenia jest uzupełnienie content hash według dokumentacji Convex podczas rag.add, ponieważ mogą zdarzyć się zduplikowane pliki. 

## Strategia OCR i parsowania dokumentów

- **OCR (PDF skany/obrazy)**: Mistral (Pixtral/Document OCR) przez AI SDK. Wejście: PDF/obrazy; wyjście: czysty tekst.
- **DOCX/XLSX**: bez OCR; używamy istniejących parserów (mammoth dla DOCX, XLSX→CSV dla XLSX).
- **PDF fallback**: jeśli parser tekstu zwróci znikomą ilość treści → wykonujemy OCR.
- **Limity**: konfigurowalne `documentPageLimit` (domyślnie 32) i `documentImageLimit` (domyślnie 8); respektujemy limity providera.
- **Wpięcie do RAG**: wynik OCR trafia do obecnego procesu `ingest.upsert*` (po implementacji jobów/UI).
- **Prywatność**: wysyłamy tylko plik do providera; przechowujemy wyłącznie tekst.
