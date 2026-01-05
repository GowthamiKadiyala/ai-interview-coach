# 🤖 Virtual AI Interview Coach
**An end-to-end technical interview simulator that listens, speaks, and analyzes.**

## 🚀 The Project
A full-stack AI application designed to help candidates master the **STAR method**. It ingests a PDF resume and job description to generate a personalized, high-stakes interview session.

### **Key Engineering Challenges Solved:**
- **Asynchronous Audio Handling**: Managed real-time voice streams using Azure Speech SDK.
- **State Lock Logic**: Prevented AI "double-talk" race conditions in React.
- **Robust Data Ingestion**: Built a safe PDF parsing route to handle malformed URI characters.

## 🛠️ Tech Stack
- **Frontend**: Next.js 16 (Turbopack), Tailwind CSS, Lucide Icons
- **AI Brain**: OpenAI GPT-4o-mini
- **Voice Engine**: Azure Speech-to-Text & Text-to-Speech
- **Deployment**: Vercel (CI/CD)

## 🏗️ Architecture
