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
    const prompt = `Anda adalah editor cerita dan diari profesional Bahasa Indonesia.
Tugas Anda adalah merapikan teks cerita pengguna menjadi Bahasa Indonesia yang baik, rapi, dan nyaman dibaca.

ATURAN SANGAT PENTING (MANDATORI):
1. JANGAN menambah fakta baru, plot cerita baru, atau mengelaborasikan hal yang tidak pernah ditulis oleh pengguna.
2. Tetap pertahankan makna, alur, dan isi cerita asli pengguna 100%.
3. Format teks menjadi paragraf-paragraf yang rapi dan terstruktur (dipisahkan dengan dua baris baru \\n\\n).
4. Perbaiki ejaan (EYD), tanda baca, huruf kapital, dan tata bahasa Bahasa Indonesia yang kurang tepat.
5. Buatkan usulan judul singkat yang menarik dalam Bahasa Indonesia.
6. Buatkan usulan emoji mood yang sesuai (contoh: 😊, 😌, 🔥, 😢, 😴, 🤯, 😐).

Return JSON format:
{
  "title": "Judul Singkat Bahasa Indonesia",
  "content": "Teks cerita yang sudah dirapikan per paragraf dalam Bahasa Indonesia",
  "mood": "Emoji mood"
}`;

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
        `Teks Cerita Pengguna:\n"${content}"`
    ]);

    const responseText = result.response.text();
    const data = JSON.parse(responseText);
    return data;
}

module.exports = { parseTransaction, parseFoodTransaction, askAI, prettifyStory };


