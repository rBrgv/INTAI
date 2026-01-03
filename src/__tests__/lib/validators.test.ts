import { SessionCreateSchema, AnswerSubmitSchema, SkillsExtractSchema } from '@/lib/validators';

describe('Validators', () => {
  describe('SessionCreateSchema', () => {
    it('should validate company mode with jobSetup', () => {
      const validData = {
        mode: 'company',
        resumeText: 'This is a valid resume text that is more than 50 characters long to pass validation.',
        jobSetup: {
          jdText: 'This is a valid job description that is more than 50 characters long to pass validation.',
          topSkills: ['JavaScript', 'React', 'TypeScript'],
          config: {
            questionCount: 5,
            difficultyCurve: 'balanced',
          },
        },
      };

      const result = SessionCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate individual mode with role and level', () => {
      const validData = {
        mode: 'individual',
        resumeText: 'This is a valid resume text that is more than 50 characters long to pass validation.',
        role: 'Software Engineer',
        level: 'senior',
      };

      const result = SessionCreateSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject company mode without jobSetup', () => {
      const invalidData = {
        mode: 'company',
        resumeText: 'This is a valid resume text that is more than 50 characters long to pass validation.',
      };

      const result = SessionCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject resume text shorter than 50 characters', () => {
      const invalidData = {
        mode: 'individual',
        resumeText: 'Short',
        role: 'Engineer',
        level: 'junior',
      };

      const result = SessionCreateSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('AnswerSubmitSchema', () => {
    it('should validate answer with at least 10 characters', () => {
      const validData = {
        answerText: 'This is a valid answer that is more than 10 characters.',
      };

      const result = AnswerSubmitSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject answer shorter than 10 characters', () => {
      const invalidData = {
        answerText: 'Short',
      };

      const result = AnswerSubmitSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('SkillsExtractSchema', () => {
    it('should validate JD text with at least 50 characters', () => {
      const validData = {
        jdText: 'This is a valid job description that is more than 50 characters long to pass validation.',
      };

      const result = SkillsExtractSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject JD text shorter than 50 characters', () => {
      const invalidData = {
        jdText: 'Short',
      };

      const result = SkillsExtractSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

