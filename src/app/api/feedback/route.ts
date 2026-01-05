import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { conversation } = await req.json();

    if (!conversation || conversation.length === 0) {
      return NextResponse.json(
        { error: "No conversation to analyze" },
        { status: 400 }
      );
    }

    // We ask the LLM to return JSON so we can display it beautifully
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a Senior Technical Recruiter. Analyze the following interview transcript. 
          Return a JSON object with: 
          1. "score" (integer 1-10), 
          2. "feedback" (a short paragraph summary), 
          3. "improvements" (an array of 3 specific bullet points on what they could do better).
          
          Be strict. Focus on the STAR method and technical clarity.`,
        },
        { role: "user", content: JSON.stringify(conversation) },
      ],
      response_format: { type: "json_object" }, // Crucial for clean UI
    });

    const report = JSON.parse(completion.choices[0].message.content || "{}");
    return NextResponse.json(report);
  } catch (error) {
    console.error("Feedback Error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
