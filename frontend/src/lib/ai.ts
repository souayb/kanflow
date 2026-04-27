import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function enhanceTask(title: string, description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are the Zenith Neural Prime, a high-performance logic optimizer. Your mission is to refactor the following work unit (Task Node) for maximum operational efficiency and zero-latency execution.
      
      Original Title: ${title}
      Original Description: ${description}
      
      Refinement Guidelines:
      1. title: Crystal-clear, action-oriented, and concise.
      2. description: Technical, specific, and unambiguous.
      3. definitionOfDone: 3-5 objective criteria that signal terminal state.
      4. subtasks: Granular logic blocks required for completion.
      5. potentialRisks: Threat vectors that could delay execution.
      6. suggestedPriority: low, medium, or high.
      7. aiThinking: A brief analysis of why these optimizations were made.
      
      Return the response in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            enhancedTitle: { type: Type.STRING },
            enhancedDescription: { type: Type.STRING },
            subtasks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            potentialRisks: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            suggestedPriority: { 
              type: Type.STRING,
              enum: ["low", "medium", "high"]
            },
            definitionOfDone: { type: Type.STRING, description: "Clear criteria for when the task is considered finished" },
            aiThinking: { type: Type.STRING, description: "Your brief reasoning behind these improvements" }
          },
          required: ["enhancedTitle", "enhancedDescription", "suggestedPriority", "definitionOfDone"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Enhancement Error:", error);
    throw error;
  }
}

export async function refineTaskToSMART(title: string, description: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a high-performance project management consultant. Transform this task into a "SMART" unit (Specific, Measurable, Achievable, Relevant, Time-bound).
      
      Original Title: ${title}
      Original Description: ${description}
      
      Focus on reducing ambiguity. The title should be action-oriented. The description should include specific deliverables and success criteria.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            smartTitle: { type: Type.STRING },
            smartDescription: { type: Type.STRING },
            logic: { type: Type.STRING, description: "Markdown-formatted explanation of the neural refinements made to satisfy SMART criteria" }
          },
          required: ["smartTitle", "smartDescription", "logic"]
        }
      }
    });
    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    return JSON.parse(text);
  } catch (error) {
    console.error("SMART Refinement Error:", error);
    throw error;
  }
}

export async function summarizeProjectProgress(projectData: any) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Summarize the progress and health of this project. Identify bottlenecks or areas for improvement.
      Project Data: ${JSON.stringify(projectData)}`,
      config: {
        systemInstruction: "You are a senior project analyst. Provide concise, impactful executive summaries.",
      }
    });
    return response.text;
  } catch (error) {
    console.error("AI Summary Error:", error);
    return "Could not generate AI summary at this time.";
  }
}
