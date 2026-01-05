import { NextResponse } from "next/server";
import PDFParser from "pdf2json";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. Initialize the parser correctly for TypeScript/Next.js
    const pdfParser = new (PDFParser as any)(null, true);

    const parsedText = await new Promise<string>((resolve, reject) => {
      // 2. Safe data processing to prevent URI malformed crashes
      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        const rawText = pdfData.Pages.flatMap((page: any) =>
          page.Texts.flatMap((text: any) =>
            text.R.map((r: any) => {
              try {
                // Try to decode normally
                return decodeURIComponent(r.T);
              } catch (e) {
                // Fallback to raw text if it's a malformed character
                return r.T;
              }
            })
          )
        ).join(" ");
        resolve(rawText);
      });

      pdfParser.on("pdfParser_dataError", (errData: any) => {
        reject(errData.parserError);
      });

      // 3. Start the parsing process
      pdfParser.parseBuffer(buffer);
    });

    return NextResponse.json({ text: parsedText });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Server failed to process PDF" },
      { status: 500 }
    );
  }
}
