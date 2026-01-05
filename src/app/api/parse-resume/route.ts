import { NextResponse } from "next/server";
import PDFParser from "pdf2json";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParser = new PDFParser(null, 1); // Mode 1: Raw text extraction

    const parsedText = await new Promise<string>((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData: any) =>
        reject(errData.parserError)
      );

      pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
        try {
          // Check both standard locations for 'Pages' data
          const pages = pdfData.Pages || pdfData.formImage?.Pages;
          if (!pages) return reject("No text found in PDF");

          const text = pages
            .map((page: any) => {
              return page.Texts.map((t: any) => {
                try {
                  // Safety check for malformed characters
                  return decodeURIComponent(t.R[0].T);
                } catch {
                  return t.R[0].T;
                }
              }).join(" ");
            })
            .join("\n\n");

          resolve(text);
        } catch (err) {
          reject("Extraction failed");
        }
      });

      pdfParser.parseBuffer(buffer);
    });

    return NextResponse.json({ text: parsedText });
  } catch (error) {
    console.error("PDF Parser Error:", error);
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
