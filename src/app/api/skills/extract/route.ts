import { NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { SkillsExtractSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { logger } from "@/lib/logger";

// Configure for production
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30; // Skills extraction should be fast

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
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
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

    // Add timeout for OpenAI call (20 seconds)
    const openaiTimeout = 20000;
    const openaiPromise = getOpenAI().chat.completions.create({
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

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI API timeout')), openaiTimeout);
    });

    let response;
    try {
      response = await Promise.race([openaiPromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message === 'OpenAI API timeout') {
        logger.error("OpenAI API timeout during skills extraction", undefined, { timeout: openaiTimeout });
        return apiError(
          "Request timeout",
          "Skills extraction took too long. Please try again.",
          504
        );
      }
      throw error;
    }

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

