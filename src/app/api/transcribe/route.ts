import { NextResponse } from "next/server";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    // 1. Get the file as an ArrayBuffer directly to avoid Buffer conversion issues
    const arrayBuffer = await file.arrayBuffer();

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY!,
      process.env.AZURE_SPEECH_REGION!
    );
    speechConfig.speechRecognitionLanguage = "en-US";

    // 2. Initialize the PushStream
    const pushStream = sdk.AudioInputStream.createPushStream();

    // 3. Convert ArrayBuffer to Uint8Array to satisfy the SDK's internal expectations
    pushStream.write(new Uint8Array(arrayBuffer).buffer as ArrayBuffer);
    pushStream.close();

    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    const transcription = await new Promise<string>((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (result) => {
          recognizer.close();
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            resolve(result.text);
          } else {
            reject("Speech not recognized: " + result.reason);
          }
        },
        (err) => {
          recognizer.close();
          reject(err);
        }
      );
    });

    return NextResponse.json({ text: transcription });
  } catch (error) {
    console.error("Transcription Error:", error);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
