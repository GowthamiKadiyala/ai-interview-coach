import { NextResponse } from "next/server";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import fs from "fs";
import path from "path";
import os from "os";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const tempFilePath = path.join(os.tmpdir(), `input-${Date.now()}.wav`);
    fs.writeFileSync(tempFilePath, buffer);

    // 3. Configure Azure Speech
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY!,
      process.env.AZURE_SPEECH_REGION!
    );
    speechConfig.speechRecognitionLanguage = "en-US";

    const audioConfig = sdk.AudioConfig.fromWavFileInput(tempFilePath);
    const speechRecognizer = new sdk.SpeechRecognizer(
      speechConfig,
      audioConfig
    );

    const text = await new Promise<string>((resolve, reject) => {
      speechRecognizer.recognizeOnceAsync(
        (result) => {
          speechRecognizer.close();
          fs.unlinkSync(tempFilePath);
          resolve(result.text);
        },
        (err) => {
          speechRecognizer.close();
          fs.unlinkSync(tempFilePath);
          reject(err);
        }
      );
    });

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: "Failed to process audio" },
      { status: 500 }
    );
  }
}
