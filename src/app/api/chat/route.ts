import { NextResponse } from "next/server";
import OpenAI from "openai";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { userText, resumeText, jobDescription, conversationHistory } =
      await req.json();

    const systemPrompt = `
  You are an expert interviewer. 
  1. Analyze the provided Job Description: "${jobDescription}"
  2. Analyze the Candidate Resume: "${resumeText}"
  3. Conduct a 5-question interview. 
  4. Focus 60% on technical skills from the JD and 40% on behavioral (STAR method).
  5. If the candidate is vague, ask a follow-up like "Can you walk me through the specific steps you took?"
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
