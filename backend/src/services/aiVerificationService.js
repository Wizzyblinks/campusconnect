import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const verifyStudentDocument = async (file, documentType) => {
  const base64Image = file.buffer.toString("base64");

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [
      {
        text: `
You are a student-document screening assistant for Campus Connect.

Analyze the supplied document image.

Document type claimed by the student: ${documentType}

Check:
1. Does the image actually appear to be the claimed document type?
2. Does it appear related to an educational institution?
3. Is it clear and readable?
4. Does it contain expected student information such as a student name, institution name, student ID or matriculation number?
5. Are there obvious visual inconsistencies or signs that the document may be altered?
6. Is there enough evidence to confidently approve it?

Do not claim that the document is legally authentic.

Return ONLY JSON:

{
  "decision": "approved" | "rejected" | "manual_review",
  "confidence": 0,
  "documentTypeMatch": true,
  "institutionDetected": true,
  "studentNameDetected": true,
  "studentIdDetected": true,
  "reason": "short explanation"
}

Use manual_review when important information is unclear or confidence is insufficient.
`,
      },
      {
        inlineData: {
          mimeType: file.mimetype,
          data: base64Image,
        },
      },
    ],
  });

  const text = response.text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(text);
};

export default verifyStudentDocument;
