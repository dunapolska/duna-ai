import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";
import PDFParser from "pdf2json";
import os from "os";
import path from "path";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData: FormData = await req.formData();
    const uploadedFiles = formData.getAll("FILE");
    let fileName = "";
    let parsedText = "";

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return new NextResponse("No File Found", { status: 404 });
    }

    const uploadedFile = uploadedFiles[0];
    if (!(uploadedFile instanceof File)) {
      return new NextResponse("Uploaded file is not in the expected format.", { status: 400 });
    }

    fileName = uuidv4();
    const tmpDir = path.join(os.tmpdir(), "pdf-uploads");
    await fs.mkdir(tmpDir, { recursive: true });
    const tempFilePath = path.join(tmpDir, `${fileName}.pdf`);
    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    await fs.writeFile(tempFilePath, fileBuffer);

    const pdfParser: any = new (PDFParser as any)(null, 1);
    await new Promise<void>((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData?.parserError ?? errData));
      pdfParser.on("pdfParser_dataReady", () => {
        parsedText = (pdfParser as any).getRawTextContent();
        resolve();
      });
      pdfParser.loadPDF(tempFilePath);
    });

    const response = new NextResponse(parsedText);
    response.headers.set("FileName", fileName);
    return response;
  } catch (e: any) {
    console.error("/api/parse-pdf error:", e);
    return new NextResponse("Parse error: " + (e?.message ?? "unknown"), { status: 500 });
  }
}


