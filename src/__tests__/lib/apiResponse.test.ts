import { apiSuccess, apiError } from '@/lib/apiResponse';

describe('API Response Helpers', () => {
  describe('apiSuccess', () => {
    it('should return success response with data', async () => {
      const data = { id: '123', name: 'Test' };
      const response = apiSuccess(data, 'Success message', 200);

      expect(response.status).toBe(200);
      return response.json().then((body) => {
        expect(body.success).toBe(true);
        expect(body.data).toEqual(data);
        expect(body.message).toBe('Success message');
      });
    });

    it('should use default status 200', () => {
      const response = apiSuccess({ test: 'data' });
      expect(response.status).toBe(200);
    });
  });

  describe('apiError', () => {
    it('should return error response', async () => {
      const response = apiError('Error code', 'Error message', 400);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Error code');
      expect(body.message).toBe('Error message');
    });

    it('should include details when provided', async () => {
      const details = { field: 'email', reason: 'invalid format' };
      const response = apiError('Validation failed', 'Invalid input', 400, details);

      const body = await response.json();
      expect(body.details).toEqual(details);
    });

    it('should use default status 500', () => {
      const response = apiError('Error', 'Message');
      expect(response.status).toBe(500);
    });
  });
});

