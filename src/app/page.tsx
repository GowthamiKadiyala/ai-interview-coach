"use client";
import { useState, useRef, useEffect } from "react";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import {
  Mic,
  Loader2,
  Square,
  Trophy,
  Upload,
  AlertCircle,
} from "lucide-react";
import axios from "axios";

interface FeedbackReport {
  score: number;
  feedback: string;
  improvements: string[];
}

export default function Home() {
  const [phase, setPhase] = useState<"setup" | "interview">("setup");
  const [resumeText, setResumeText] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle");
  const [conversation, setConversation] = useState<
    { role: string; text: string }[]
  >([]);
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognizerRef = useRef<sdk.SpeechRecognizer | null>(null);

  // Turn lock with safety reset
  const isAIGenerating = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio();
    }
    return () => {
      if (recognizerRef.current) recognizerRef.current.close();
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post("/api/parse-resume", formData);
      setResumeText(res.data.text);
    } catch (err) {
      alert("Resume parse failed.");
    } finally {
      setIsParsing(false);
    }
  };

  const endInterview = async () => {
    // FORCE RESET: Kill all active processes regardless of lock status
    if (recognizerRef.current) {
      try {
        recognizerRef.current.close();
      } catch (e) {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    isAIGenerating.current = false;
    setStatus("idle");
    setIsGeneratingReport(true);

    try {
      const res = await axios.post("/api/feedback", {
        conversation,
        resumeText: resumeText || "Not provided",
        jobDescription: jobDesc || "Not provided",
      });
      setReport(res.data);
    } catch (err) {
      alert("Analysis failed. Please try again.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleAIResponse = async (text: string, currentHistory: any[]) => {
    if (isAIGenerating.current) return;
    isAIGenerating.current = true;

    setStatus("thinking");

    // Safety Timeout: Reset the lock if the API or Audio hangs
    const safetyTimer = setTimeout(() => {
      if (isAIGenerating.current) {
        console.warn("AI Turn Lock timed out. Resetting.");
        isAIGenerating.current = false;
        setStatus("idle");
      }
    }, 12000);

    try {
      const response = await axios.post("/api/chat", {
        userText: text,
        resumeText,
        jobDescription: jobDesc,
        conversationHistory: currentHistory.map((c) => ({
          role: c.role === "You" ? "user" : "assistant",
          content: c.text,
        })),
      });
      const { text: aiText, audio } = response.data;

      setConversation((prev) => [...prev, { role: "AI Coach", text: aiText }]);

      if (audioRef.current) {
        audioRef.current.src = audio;
        setStatus("speaking");
        audioRef.current.play();
        audioRef.current.onended = () => {
          clearTimeout(safetyTimer);
          setStatus("idle");
          isAIGenerating.current = false;
        };
      } else {
        clearTimeout(safetyTimer);
        setStatus("idle");
        isAIGenerating.current = false;
      }
    } catch (error) {
      clearTimeout(safetyTimer);
      setStatus("idle");
      isAIGenerating.current = false;
    }
  };

  const startListening = async () => {
    if (status !== "idle" || isAIGenerating.current) return;
    setStatus("listening");

    try {
      const tokenRes = await axios.get("/api/token");
      const { token, region } = tokenRes.data;
      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(
        token,
        region
      );
      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
      recognizerRef.current = recognizer;

      recognizer.recognizeOnceAsync(async (result) => {
        recognizer.close();
        if (result.reason === sdk.ResultReason.RecognizedSpeech) {
          const userText = result.text;
          setConversation((prev) => {
            const updated = [...prev, { role: "You", text: userText }];
            handleAIResponse(userText, updated);
            return updated;
          });
        } else {
          setStatus("idle");
        }
      });
    } catch (err) {
      setStatus("idle");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
      {phase === "setup" ? (
        <div className="max-w-xl w-full bg-white p-8 rounded-2xl shadow-xl space-y-6">
          <h1 className="text-3xl font-black text-slate-900 text-center uppercase tracking-tight">
            Interview Setup
          </h1>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center relative hover:bg-slate-50">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span className="text-sm font-black mt-2 text-slate-900 uppercase">
                {resumeText
                  ? "✅ Resume Loaded Successfully"
                  : "Click to Upload Resume (PDF)"}
              </span>
            </div>
            <textarea
              className="w-full h-40 p-4 border-2 border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-600"
              placeholder="Paste Job Description here..."
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              setPhase("interview");
              handleAIResponse("", []);
            }}
            disabled={!resumeText || !jobDesc}
            className="w-full py-4 bg-blue-600 text-white font-black text-lg rounded-xl shadow-lg uppercase"
          >
            Start Interview
          </button>
        </div>
      ) : (
        <div className="max-w-3xl w-full flex flex-col items-center gap-8 relative">
          <div className="text-center">
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
              Targeted Interview
            </h1>
            <p className="text-slate-800 font-bold text-sm border-b-2 border-blue-500 inline-block pb-1">
              Specialized Technical Deep-Dive
            </p>
          </div>

          <div className="flex flex-col items-center gap-10 w-full">
            <div className="relative z-10">
              <button
                onClick={startListening}
                disabled={
                  status !== "idle" || isAIGenerating.current || !!report
                }
                className={`h-32 w-32 rounded-full flex items-center justify-center shadow-2xl transition-all ${
                  status === "listening"
                    ? "bg-red-500 animate-pulse"
                    : status === "speaking"
                    ? "bg-green-500 opacity-50"
                    : "bg-blue-600 hover:scale-105"
                }`}
              >
                <Mic className="text-white h-12 w-12" />
              </button>
              <div className="absolute -bottom-6 left-0 right-0 text-center font-black text-slate-900 uppercase text-xs tracking-widest">
                {status}
              </div>
            </div>

            {/* END BUTTON - NOW INDEPENDENT OF LOCK */}
            {!report && (
              <button
                onClick={endInterview}
                disabled={isGeneratingReport}
                className="z-[99] cursor-pointer flex items-center gap-2 px-10 py-4 bg-slate-900 text-white font-black rounded-full shadow-2xl hover:bg-black hover:scale-105 active:scale-95 transition-all uppercase tracking-tighter"
              >
                {isGeneratingReport ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Square size={16} fill="currentColor" />
                )}
                {isGeneratingReport ? "Analyzing..." : "End & Get Feedback"}
              </button>
            )}
          </div>

          {report && (
            <div className="w-full bg-white rounded-2xl shadow-2xl border-2 border-slate-100 overflow-hidden">
              <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                <h2 className="text-xl font-black uppercase tracking-widest">
                  Scorecard
                </h2>
                <div className="text-5xl font-black">
                  {report.score}
                  <span className="text-xl text-slate-400">/10</span>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-slate-900 text-lg font-bold leading-relaxed border-l-8 border-blue-600 pl-6">
                  {report.feedback}
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-5 bg-slate-900 text-white font-black uppercase rounded-xl"
                >
                  New Session
                </button>
              </div>
            </div>
          )}

          {!report && (
            <div className="w-full bg-white rounded-2xl shadow-inner border-2 border-slate-100 p-8 min-h-[300px] space-y-6 overflow-y-auto max-h-[500px]">
              {conversation.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${
                    msg.role === "You" ? "items-end" : "items-start"
                  }`}
                >
                  <span className="text-xs font-black text-slate-900 mb-2 uppercase px-1 tracking-widest">
                    {msg.role}
                  </span>
                  <div
                    className={`px-5 py-3 rounded-2xl text-base font-black max-w-[85%] shadow-sm ${
                      msg.role === "You"
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-slate-100 text-slate-900 rounded-tl-none border border-slate-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
