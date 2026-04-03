import { NextRequest, NextResponse } from "next/server";
const pdfParse = require("pdf-parse");
import mammoth from "mammoth";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (file.name.endsWith(".pdf") || file.type === "application/pdf") {
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const data = await mammoth.extractRawText({ buffer });
      text = data.value;
    } else {
      text = buffer.toString("utf-8"); // Assume plain text
    }

    return NextResponse.json({ success: true, text });
  } catch (error: any) {
    console.error("[file-analysis] Extraction error:", error);
    return NextResponse.json({ error: "Failed to extract text from file: " + error.message }, { status: 500 });
  }
}
