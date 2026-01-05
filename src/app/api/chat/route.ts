import { NextResponse } from "next/server";
import OpenAI from "openai";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { userText, resumeText, jobDescription, conversationHistory } =
      await req.json();

    const systemPrompt = `
      You are a Senior Technical Recruiter. 
      CONTEXT:
      Resume: "${(resumeText || "").slice(0, 2000)}"
      Job Description: "${(jobDescription || "").slice(0, 2000)}"
      
      STRICT RULES:
      1. ASK ONLY ONE QUESTION AT A TIME. Do not ask multi-part questions.
      2. After asking a question, STOP and wait for the user to provide a complete answer.
      3. Acknowledge the user's previous answer briefly before asking the NEXT single question.
      4. Do not provide feedback or a scorecard mid-interview.
      5. Keep responses under 2 sentences.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: userText || "Let's start the interview." },
      ],
    });

    const aiText =
      completion.choices[0].message.content ||
      "Could you tell me about your experience?";

    // Azure TTS for high-quality voice
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY!,
      process.env.AZURE_SPEECH_REGION!
    );
    speechConfig.speechSynthesisVoiceName = "en-US-AndrewMultilingualNeural";
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    const audioBase64 = await new Promise<string>((resolve, reject) => {
      synthesizer.speakTextAsync(
        aiText,
        (result) => {
          const audioData = Buffer.from(result.audioData).toString("base64");
          synthesizer.close();
          resolve(audioData);
        },
        (err) => {
          synthesizer.close();
          reject(err);
        }
      );
    });

    return NextResponse.json({
      text: aiText,
      audio: `data:audio/wav;base64,${audioBase64}`,
    });
  } catch (error) {
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
