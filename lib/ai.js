const { GoogleGenerativeAI } = require("@google/generative-ai");
const { toJakartaDateStr } = require("./helpers");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite", // Updated model name for consistency if needed
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
            type: "object",
            properties: {
                date: { type: "string" },
                transactions: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            type: { type: "string" },
                            item: { type: "string" },
                            amount: { type: "number" },
                            category: { type: "string" },
                            date: { type: "string" }
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
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite",
});

const storyModel = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-lite",
    generationConfig: {
        responseMimeType: "application/json"
    }
});

async function parseTransaction(text, audioBuffer = null) {
    const todayStr = toJakartaDateStr(new Date());
    const prompt = `Extract transaction data and date. If there are multiple items, return all in transactions array.

Reference Date (Today): ${todayStr} (Asia/Jakarta, WIB)

Date Rules:
- If user specifies a relative or explicit date (e.g. "kemarin", "kemarin lusa", "2 hari lalu", "24 sept", "24 September", "24/09", "tgl 24"), calculate the exact date in YYYY-MM-DD format.
- "kemarin" = 1 day before Reference Date.
- If no date specified, use "${todayStr}".
- Return date in YYYY-MM-DD format on both top-level "date" and each transaction's "date" field.

Rules:
- rb = thousand
- k = thousand
- jt = million

Detect:
- expense
- income

Return JSON only.`;

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
    const resolvedDate = data.date || todayStr;
    const items = (data.transactions || []).map(t => ({
        ...t,
        date: t.date || resolvedDate
    }));
    return items;
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
2. Tetap pertahankan alur, fakta, dan isi cerita asli 100%.
3. Rapikan teks menjadi paragraf-paragraf yang jelas dan teratur (dipisahkan dengan dua baris baru).
4. Perbaiki ejaan (EYD), tanda baca, huruf kapital, dan tata bahasa Bahasa Indonesia.
5. Pada baris pertama, buatkan judul singkat dalam format "JUDUL: <judul>", diikuti baris kosong, lalu isi cerita yang sudah dirapikan.

Teks Cerita Pengguna:
"${content}"`;

    try {
        const result = await chatModel.generateContent(prompt);
        let text = result.response.text().trim();
        
        // Remove markdown codeblock fences if returned
        text = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

        let title = "";
        const titleMatch = text.match(/^JUDUL:\s*(.*)/i);
        if (titleMatch) {
            title = titleMatch[1].trim();
            text = text.replace(/^JUDUL:\s*.*\n*/i, "").trim();
        }

        return {
            title: title,
            content: text,
            mood: ""
        };
    } catch (err) {
        console.error("Story Prettify AI Error:", err);
        throw new Error("Gagal merapikan cerita dari AI: " + err.message);
    }
}

module.exports = { parseTransaction, parseFoodTransaction, askAI, prettifyStory };


