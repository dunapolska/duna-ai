export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const maybeFile = formData.get("file") ?? formData.get("FILE");
    if (!(maybeFile instanceof File)) {
      return new Response("Missing 'file' in form-data", { status: 400 });
    }

    const file = maybeFile as File;
    // Tu w kolejnych krokach dołączymy zapis do Convex Storage / ingest
    return Response.json({
      fileName: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (err) {
    console.error("/api/upload error", err);
    return new Response("Upload failed", { status: 500 });
  }
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405 });
}


