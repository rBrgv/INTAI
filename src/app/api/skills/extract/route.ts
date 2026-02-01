import { getOpenAI } from "@/lib/openai";
import { SkillsExtractSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Vercel serverless function configuration
export const maxDuration = 30; // 30 seconds for OpenAI API calls
export const dynamic = 'force-dynamic'; // Disable caching


export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("Invalid JSON", "Request body must be valid JSON", 400);
    }

    const validationResult = SkillsExtractSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return apiError("Validation failed", errors, 400);
    }

    const { jdText } = validationResult.data;

    if (!process.env.OPENAI_API_KEY) {
      return apiError(
        "Configuration error",
        "OPENAI_API_KEY is not configured",
        500
      );
    }

    const prompt = `Extract the top 5-10 most important technical and soft skills mentioned in this job description. Focus on:
- Programming languages, frameworks, and technologies
- Technical competencies (e.g., "API design", "database optimization")
- Soft skills (e.g., "leadership", "communication", "problem-solving")
- Domain-specific skills (e.g., "AWS", "Docker", "Agile")

Return only a JSON object with a "skills" array. No explanations, just the skills.

Job Description:
${jdText}

Return format: {"skills": ["Skill1", "Skill2", "Skill3", ...]}`;

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" } as any,
      messages: [
        {
          role: "system",
          content: "You are a skills extraction assistant. Return JSON only in this exact format: {\"skills\": [\"skill1\", \"skill2\", ...]}. Extract 5-10 most relevant skills from the job description."
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed: { skills?: string[] };

    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      logger.error("Failed to parse skills response", parseError instanceof Error ? parseError : new Error(String(parseError)), { content: content.substring(0, 200) });
      return apiError(
        "Failed to parse skills from AI response",
        "The AI model returned an unparseable response",
        500
      );
    }

    const skills = Array.isArray(parsed.skills)
      ? parsed.skills.slice(0, 10).filter((s: string) => s && typeof s === 'string' && s.trim())
      : [];

    return apiSuccess({ skills }, "Skills extracted successfully");
  } catch (error) {
    logger.error("Error extracting skills", error instanceof Error ? error : new Error(String(error)));
    return apiError(
      "Failed to extract skills",
      error instanceof Error ? error.message : "Unknown error",
      500
    );
  }
}

