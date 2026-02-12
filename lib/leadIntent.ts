import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function detectLeadIntent(message: string) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
You classify whether the user shows buying intent.
Return ONLY one word:
none
low
high

High intent examples:
"I want to book"
"Send me an offer"
"How can I start"
"I am interested"
"Let's proceed"
        `
      },
      {
        role: "user",
        content: message
      }
    ]
  })

  return res.choices[0].message.content?.trim() || "none"
}
