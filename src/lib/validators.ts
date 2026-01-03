import { z } from 'zod';

// Session Creation Schema
export const SessionCreateSchema = z.object({
  mode: z.enum(['company', 'college', 'individual']),
  resumeText: z.string().min(50, 'Resume text must be at least 50 characters'),
  resumeId: z.string().uuid().optional(),
  role: z.string().min(1).optional(),
  level: z.enum(['junior', 'mid', 'senior']).optional(),
  jobSetup: z.object({
    jdText: z.string().optional(),
    topSkills: z.array(z.string().min(1)).optional(),
    resumeText: z.string().min(50).optional(),
    config: z.object({
      questionCount: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(25)]),
      difficultyCurve: z.enum(['easy_to_hard', 'balanced', 'custom']),
      customDifficulty: z.array(z.enum(['easy', 'medium', 'hard'])).optional(),
    }),
  }).optional(),
}).superRefine((data, ctx) => {
  // Company mode validation
  if (data.mode === 'company') {
    if (!data.jobSetup?.jdText || data.jobSetup.jdText.length < 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Job description must be at least 50 characters for company mode',
        path: ['jobSetup', 'jdText'],
      });
    }
    if (!data.jobSetup?.topSkills || data.jobSetup.topSkills.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one skill is required for company mode',
        path: ['jobSetup', 'topSkills'],
      });
    }
    if (data.jobSetup?.topSkills && data.jobSetup.topSkills.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Maximum 5 skills allowed',
        path: ['jobSetup', 'topSkills'],
      });
    }
  }
  
  // Individual mode validation
  if (data.mode === 'individual') {
    if (!data.role || data.role.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Role is required for individual mode',
        path: ['role'],
      });
    }
    if (!data.level) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Level is required for individual mode',
        path: ['level'],
      });
    }
  }
});

// Answer Submission Schema
export const AnswerSubmitSchema = z.object({
  answerText: z.string().min(10, 'Answer must be at least 10 characters'),
});

// Skills Extraction Schema
export const SkillsExtractSchema = z.object({
  jdText: z.string().min(50, 'Job description must be at least 50 characters'),
});

// College Template Schema
export const CollegeTemplateSchema = z.object({
  jdText: z.string().min(50),
  topSkills: z.array(z.string().min(1)).min(1).max(5),
  config: z.object({
    questionCount: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(25)]),
    difficultyCurve: z.enum(['easy_to_hard', 'balanced', 'custom']),
    customDifficulty: z.array(z.enum(['easy', 'medium', 'hard'])).optional(),
  }),
  collegeId: z.string().optional(),
  createdBy: z.string().optional(),
});

// College Batch Schema
export const CollegeBatchSchema = z.object({
  jobTemplateId: z.string().uuid(),
  candidates: z.array(
    z.object({
      email: z.string().email(),
      name: z.string().min(1),
      studentId: z.string().optional(),
    })
  ).min(1),
});

// Type exports
export type SessionCreateInput = z.infer<typeof SessionCreateSchema>;
export type AnswerSubmitInput = z.infer<typeof AnswerSubmitSchema>;
export type SkillsExtractInput = z.infer<typeof SkillsExtractSchema>;
export type CollegeTemplateInput = z.infer<typeof CollegeTemplateSchema>;
export type CollegeBatchInput = z.infer<typeof CollegeBatchSchema>;

