const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite", // Updated model name for consistency if needed
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "object",
            properties: {
                transactions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string" },
                            item: { type: "string" },
                            amount: { type: "number" },
                            category: { type: "string" }
                        },
                        required: ["type", "item", "amount", "category"]
                    }
                }
            },
            required: ["transactions"]
        }
    }
});

const foodModel = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "object",
            properties: {
                foodName: { type: "string" },
                category: { type: "string" }
            },
            required: ["foodName", "category"]
        }
    }
});

const chatModel = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
});

async function parseTransaction(text, audioBuffer = null) {
    const prompt = `Extract transaction data. If there are multiple items, return all of them in the transactions array.\n\nRules:\n- rb = thousand\n- k = thousand\n- jt = million\n\nDetect:\n- expense\n- income\n\nReturn JSON only.`;

    let parts = [prompt];
    if (text) parts.push(`Message:\n"${text}"`);
    if (audioBuffer) {
        parts.push({
            inlineData: {
                data: audioBuffer.toString("base64"),
                mimeType: "audio/ogg"
            }
        });
    }

    const result = await model.generateContent(parts);
    const response = result.response.text();
    const data = JSON.parse(response);
    return data.transactions || [];
}

async function parseFoodTransaction(text) {
    const prompt = `Categorize the following food/drink item into a broad category (e.g., Makanan Berat, Minuman, Camilan, Buah) and provide a clean name in Indonesian.\n\nMessage: "${text}"\n\nReturn JSON only.`;

    const result = await foodModel.generateContent(prompt);
    const response = result.response.text();
    const data = JSON.parse(response);
    return data;
}

async function askAI(question, transactions) {
    const context = transactions.map(t => {
        const date = t.createdAt ? new Date(t.createdAt).toLocaleDateString("id-ID") : "N/A";
        return `- ${date}: ${t.item} (Rp${t.amount}) [${t.category}]`;
    }).join("\n");
    
    const prompt = `You are a helpful financial assistant.
Analyze the user's spending data below and answer their question.
Be concise but insightful. Use Indonesian if the user asks in Indonesian, otherwise use English.

IMPORTANT: Use Telegram Markdown V1 rules:
- *bold text* (single asterisk)
- _italic text_ (single underscore)
- Avoid double asterisks.

DATA:
${context || "No transactions recorded yet."}

QUESTION:
${question}`;

    const result = await chatModel.generateContent(prompt);
    return result.response.text();
}

async function prettifyStory(content) {
    const prompt = `You are an expert story and diary editor.
Your task is to take the user's raw story text and improve its readability, paragraphing, grammar, and flow.

CRITICAL RULES:
- Do NOT add new plot elements, fictional details, or elaborate beyond what the user wrote.
- Keep the original tone, language (Indonesian or English), and exact personal story meaning intact.
- Format the output into clean, well-structured paragraphs separated by double line breaks (\\n\\n).
- Fix spelling mistakes, punctuation, and run-on sentences.
- Suggest a short fitting title for the story if possible.
- Suggest a fitting emoji mood (e.g. 😊, 😌, 🔥, 😢, 😴, 🤯, 😐).

Return JSON only.`;

    const storyGenModel = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    content: { type: "string" },
                    mood: { type: "string" }
                },
                required: ["content"]
            }
        }
    });

    const result = await storyGenModel.generateContent([
        prompt,
        `User Story Content:\n"${content}"`
    ]);

    const responseText = result.response.text();
    const data = JSON.parse(responseText);
    return data;
}

module.exports = { parseTransaction, parseFoodTransaction, askAI, prettifyStory };


