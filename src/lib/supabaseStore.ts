import { supabase, isSupabaseConfigured, TABLES, getSupabaseClient } from './supabase';
import { InterviewSession, CollegeJobTemplate, CandidateBatch } from './types';
import { logger } from './logger';

// ============================================
// SESSION STORE (Supabase)
// ============================================

export async function createSession(session: InterviewSession): Promise<InterviewSession> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  // Use admin client for server-side operations to ensure consistency
  const client = getSupabaseClient(true) || supabase;
  if (!client) {
    throw new Error('Supabase client not available');
  }

  const { data, error } = await client
    .from(TABLES.SESSIONS)
    .insert({
      id: session.id,
      mode: session.mode,
      status: session.status,
      created_at: new Date(session.createdAt).toISOString(),
      resume_text: session.resumeText,
      jd_text: session.jdText,
      role: session.role,
      level: session.level,
      questions: session.questions || [],
      current_question_index: session.currentQuestionIndex || 0,
      answers: session.answers || [],
      evaluations: session.evaluations || [],
      score_summary: session.scoreSummary,
      report: session.report,
      share_token: session.shareToken,
      job_setup: session.jobSetup,
      college_job_template_id: session.collegeJobTemplateId,
      candidate_email: session.candidateEmail,
      candidate_name: session.candidateName,
      student_id: session.studentId,
      tab_switch_count: session.tabSwitchCount || 0,
      tab_switch_events: session.tabSwitchEvents || [],
      presence: session.presence,
      completed_at: session.status === "completed" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating session', error instanceof Error ? error : new Error(String(error)), { sessionId: session.id, mode: session.mode });
    throw error;
  }

  // Log to audit
  await logAudit('session_created', 'session', session.id, {
    mode: session.mode,
    status: session.status,
  });

  return mapDbSessionToSession(data);
}

export async function getSession(id: string, expectedUpdatedAt?: string): Promise<InterviewSession | null> {
  if (!isSupabaseConfigured()) {
    logger.warn('Supabase not configured in getSession', { sessionId: id });
    return null;
  }

  logger.debug('Querying Supabase for session', { sessionId: id, table: TABLES.SESSIONS, expectedUpdatedAt });
  console.log(`[GET SESSION] Querying session ${id}${expectedUpdatedAt ? ` (expecting updated_at >= ${expectedUpdatedAt})` : ''}`);
  
  // Use admin client for server-side reads to bypass read replicas
  // This ensures we get fresh data immediately after updates
  const client = getSupabaseClient(true); // Use admin client to bypass read replicas
  if (!client) {
    logger.warn('Supabase client not available, falling back to anon key', { sessionId: id });
    // Fall back to regular client if admin not available
    if (!supabase) {
      return null;
    }
  }
  
  // Retry mechanism to handle read replica lag (if using anon key)
  // If using admin key, we should get fresh data immediately, but still retry for safety
  let data = null;
  let error = null;
  const useAdmin = client !== supabase; // Check if we're using admin client
  const maxRetries = useAdmin ? 3 : 10; // Fewer retries if using admin (should be fresh)
  const retryDelay = useAdmin ? 100 : 500; // Shorter delay if using admin
  const maxStaleness = 60000; // 60 seconds - if updated_at is older than this, it's definitely stale
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`[GET SESSION] Retry attempt ${attempt + 1}/${maxRetries} (read replica lag?)`);
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
    
    // Use the appropriate client (admin for server-side, anon for client-side)
    const result = await (client || supabase)!
      .from(TABLES.SESSIONS)
      .select('*')
      .eq('id', id)
      .single();
    
    // Note: Supabase doesn't support direct cache control, but we can try to force fresh reads
    // by using the service role key for critical reads (if available)
    
    error = result.error;
    data = result.data;
    
    // Log what we actually got from the database
    if (data) {
      console.log(`[GET SESSION] Attempt ${attempt + 1} - status: ${data.status}, questions: ${data.questions?.length || 0}, updated_at: ${data.updated_at}`);
      
      let shouldRetry = false;
      
      // Check 1: If we have an expected timestamp and this data is older, retry
      if (expectedUpdatedAt && data.updated_at) {
        const dataTime = new Date(data.updated_at).getTime();
        const expectedTime = new Date(expectedUpdatedAt).getTime();
        if (dataTime < expectedTime) {
          console.log(`[GET SESSION] Data is stale (${data.updated_at} < ${expectedUpdatedAt}), retrying...`);
          shouldRetry = true;
        } else {
          console.log(`[GET SESSION] Got fresh data (${data.updated_at} >= ${expectedUpdatedAt})`);
        }
      }
      
      // Check 2: If status is "created" with 0 questions, check if data might be stale
      // This handles cases where the session was just updated but read replica hasn't caught up
      if (!shouldRetry && data.status === "created" && (!data.questions || data.questions.length === 0)) {
        // Check how old the data is - if it's very old, it's probably actually "created"
        // But if it's recent (within last 2 minutes), it might be stale
        const dataTime = new Date(data.updated_at).getTime();
        const now = Date.now();
        const age = now - dataTime;
        
        // If data is less than 2 minutes old, it might be stale (retry)
        // If it's older, it's probably actually "created" (don't retry)
        if (age < 120000 && attempt < maxRetries - 1) {
          console.log(`[GET SESSION] Status is 'created' with 0 questions, data is ${Math.round(age/1000)}s old (might be stale), retrying...`);
          shouldRetry = true;
        } else if (age >= 120000) {
          console.log(`[GET SESSION] Status is 'created' with 0 questions, but data is ${Math.round(age/1000)}s old (probably actually created), not retrying`);
        }
      }
      
      // Check 3: If data looks suspiciously stale (status is "created" but updated_at is very recent)
      // This suggests the session might have been updated but we're seeing old data
      if (!shouldRetry && data.status === "created" && data.updated_at) {
        const dataTime = new Date(data.updated_at).getTime();
        const now = Date.now();
        const age = now - dataTime;
        
        // If the data was updated recently (within last 60 seconds) but status is still "created",
        // it might be stale (unless it really is still "created")
        if (age < maxStaleness && attempt < maxRetries - 1) {
          console.log(`[GET SESSION] Data might be stale (status: created, but updated ${Math.round(age/1000)}s ago), retrying...`);
          shouldRetry = true;
        }
      }
      
      if (!shouldRetry) {
        break;
      }
    } else if (error && error.code !== 'PGRST116') {
      // Real error, don't retry
      break;
    } else {
      // No data and no error (or PGRST116), break
      break;
    }
  }

  if (error) {
    // If error code is PGRST116, the row doesn't exist (not an error)
    if (error.code === 'PGRST116') {
      logger.debug('Session not found in Supabase (PGRST116)', { sessionId: id });
      return null;
    }
    
    // Log detailed error information
    logger.error('Error fetching session from Supabase', error instanceof Error ? error : new Error(String(error)), { 
      sessionId: id,
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error.details,
      errorHint: error.hint,
      table: TABLES.SESSIONS,
      possibleCauses: [
        error.code === '42P01' ? 'Table does not exist - run database migrations' : null,
        error.code === '42501' ? 'Permission denied - check RLS policies' : null,
        error.message?.includes('relation') ? 'Table not found - check migrations' : null,
        error.message?.includes('permission') ? 'RLS policy blocking access' : null,
      ].filter(Boolean)
    });
    throw error;
  }

  if (!data) {
    logger.debug('No data returned from Supabase query', { sessionId: id });
    return null;
  }

  logger.debug('Session data retrieved from Supabase', { 
    sessionId: id, 
    status: data.status,
    hasQuestions: !!data.questions?.length
  });

  return mapDbSessionToSession(data);
}

export async function updateSession(
  id: string,
  updater: (s: InterviewSession) => InterviewSession
): Promise<InterviewSession | null> {
  console.log(`[UPDATE SESSION] Called for session ${id}`);
  if (!isSupabaseConfigured() || !supabase) {
    console.log(`[UPDATE SESSION] Supabase not configured`);
    return null;
  }

  // Get current session
  const current = await getSession(id);
  if (!current) {
    console.log(`[UPDATE SESSION] Session not found: ${id}`);
    logger.error('Cannot update: session not found', undefined, { sessionId: id });
    return null;
  }

  console.log(`[UPDATE SESSION] Current session status: ${current.status}, questions: ${current.questions?.length || 0}`);
  // Apply update
  const updated = updater(current);
  console.log(`[UPDATE SESSION] After updater - status: ${updated.status}, questions: ${updated.questions?.length || 0}`);

  // Build update payload - ensure questions is always an array
  const questions = Array.isArray(updated.questions) ? updated.questions : [];

  logger.info('Updating session in Supabase', { 
    sessionId: id, 
    status: updated.status, 
    questionCount: questions.length,
    currentQuestionIndex: updated.currentQuestionIndex 
  });

  const updatePayload: any = {
    status: updated.status,
    resume_text: updated.resumeText || '',
    questions: questions, // Always an array
    current_question_index: updated.currentQuestionIndex || 0,
    answers: Array.isArray(updated.answers) ? updated.answers : [],
    evaluations: Array.isArray(updated.evaluations) ? updated.evaluations : [],
    score_summary: updated.scoreSummary || null,
    report: updated.report || null,
    share_token: updated.shareToken || null,
    job_setup: updated.jobSetup || null,
    tab_switch_count: updated.tabSwitchCount || 0,
    tab_switch_events: Array.isArray(updated.tabSwitchEvents) ? updated.tabSwitchEvents : [],
    presence: updated.presence || null,
    completed_at: updated.status === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  // Only include fields that are defined
  if (updated.jdText !== undefined) updatePayload.jd_text = updated.jdText;
  if (updated.role !== undefined) updatePayload.role = updated.role;
  if (updated.level !== undefined) updatePayload.level = updated.level;

  // Update in database
  logger.debug('Executing Supabase update', { 
    sessionId: id, 
    table: TABLES.SESSIONS,
    updatePayloadKeys: Object.keys(updatePayload),
    questionsCount: questions.length,
    status: updatePayload.status,
    questionsType: Array.isArray(questions) ? 'array' : typeof questions,
    questionsIsArray: Array.isArray(questions)
  });
  
  // Log a sample of the questions to verify structure
  if (questions.length > 0) {
    logger.debug('Questions sample', {
      sessionId: id,
      firstQuestion: {
        id: questions[0]?.id,
        text: questions[0]?.text?.substring(0, 100),
        category: questions[0]?.category,
        hasId: !!questions[0]?.id,
        hasText: !!questions[0]?.text
      }
    });
  }
  
  // Use a fresh query to ensure we get the updated data
  const { data, error, count } = await supabase
    .from(TABLES.SESSIONS)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();
  
  // If update succeeded, verify with a fresh read to ensure consistency
  if (!error && data) {
    console.log(`[UPDATE SESSION] Update succeeded, doing verification read...`);
    
    // Do a fresh read to verify the update persisted
    // Retry a few times in case of read replica lag
    // Use a longer delay to allow replication to complete
    let verifyData = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      // Increase delay with each attempt: 200ms, 400ms, 600ms, 800ms, 1000ms
      await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
      
      const { data: freshData, error: verifyError } = await supabase
        .from(TABLES.SESSIONS)
        .select('*')
        .eq('id', id)
        .single();
      
      if (verifyError) {
        logger.warn(`Verification read attempt ${attempt + 1} failed`, { sessionId: id, error: verifyError.message });
        continue;
      }
      
      if (freshData) {
        console.log(`[UPDATE SESSION] Verification read attempt ${attempt + 1} - status: ${freshData.status}, questions: ${freshData.questions?.length || 0}`);
        
        // Check if the data matches what we just wrote
        if (freshData.status === updatePayload.status && 
            Array.isArray(freshData.questions) && 
            freshData.questions.length === questions.length) {
          verifyData = freshData;
          console.log(`[UPDATE SESSION] Verification successful on attempt ${attempt + 1}`);
          break;
        } else {
          console.log(`[UPDATE SESSION] Verification mismatch - expected status: ${updatePayload.status}, got: ${freshData.status}, expected questions: ${questions.length}, got: ${freshData.questions?.length || 0}`);
        }
      }
    }
    
    // Use verified data if available, otherwise use the update response
    if (verifyData) {
      console.log(`[UPDATE SESSION] Using verified data from fresh read`);
      // Replace data with verifyData for mapping
      Object.assign(data, verifyData);
    } else {
      console.log(`[UPDATE SESSION] Warning: Could not verify update, using update response data`);
    }
  }

  logger.debug('Supabase update response', {
    sessionId: id,
    hasError: !!error,
    hasData: !!data,
    errorCode: error?.code,
    errorMessage: error?.message,
    dataStatus: data?.status,
    dataQuestionsCount: data?.questions?.length,
    dataQuestionsType: typeof data?.questions,
    dataQuestionsIsArray: Array.isArray(data?.questions)
  });

  if (error) {
    logger.error('Error updating session in Supabase', new Error(error.message), { 
      sessionId: id, 
      errorCode: error.code,
      errorMessage: error.message,
      errorDetails: error,
      errorHint: error.hint,
      updatePayload: { 
        ...updatePayload, 
        questions: `[${questions.length} questions]`,
        questionsPreview: questions.slice(0, 2).map(q => ({ id: q.id, text: q.text?.substring(0, 50) }))
      }
    });
    throw new Error(`Database update failed: ${error.message} (code: ${error.code})`);
  }

  if (!data) {
    logger.error('No data returned from Supabase update', undefined, { 
      sessionId: id,
      updatePayload: { 
        ...updatePayload, 
        questions: `[${questions.length} questions]` 
      },
      note: 'This might indicate a RLS policy issue or the row was not found'
    });
    throw new Error('No data returned from update - check RLS policies');
  }

  const mapped = mapDbSessionToSession(data);
  logger.info('Session updated successfully in Supabase', { 
    sessionId: id, 
    status: mapped.status, 
    questionCount: mapped.questions?.length || 0,
    returnedQuestionCount: data.questions?.length || 0,
    returnedStatus: data.status,
    mappedStatus: mapped.status,
    questionsMatch: mapped.questions?.length === questions.length
  });

  return mapped;
}

export async function findSessionByShareToken(token: string): Promise<InterviewSession | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(TABLES.SESSIONS)
    .select('*')
    .eq('share_token', token)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    logger.error('Error finding session by token', error instanceof Error ? error : new Error(String(error)), { token });
    return null;
  }

  return mapDbSessionToSession(data);
}

export async function getSessionsByIds(sessionIds: string[]): Promise<InterviewSession[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  if (sessionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLES.SESSIONS)
    .select('*')
    .in('id', sessionIds);

  if (error) {
    logger.error('Error getting sessions by IDs', error instanceof Error ? error : new Error(String(error)), { sessionIds: sessionIds.length });
    return [];
  }

  return (data || []).map(mapDbSessionToSession);
}

export async function getAllSessions(): Promise<InterviewSession[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLES.SESSIONS)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error getting all sessions', error instanceof Error ? error : new Error(String(error)));
    return [];
  }

  return (data || []).map(mapDbSessionToSession);
}

export async function getSessionsByMode(mode: string): Promise<InterviewSession[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLES.SESSIONS)
    .select('*')
    .eq('mode', mode)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error getting sessions by mode', error instanceof Error ? error : new Error(String(error)), { mode });
    return [];
  }

  return (data || []).map(mapDbSessionToSession);
}

export async function getSessionsByEmail(email: string): Promise<InterviewSession[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLES.SESSIONS)
    .select('*')
    .eq('candidate_email', email)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error getting sessions by email', error instanceof Error ? error : new Error(String(error)), { email });
    return [];
  }

  return (data || []).map(mapDbSessionToSession);
}

export async function getSessionsByTemplate(templateId: string): Promise<InterviewSession[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLES.SESSIONS)
    .select('*')
    .eq('college_job_template_id', templateId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error getting sessions by template', error instanceof Error ? error : new Error(String(error)), { templateId });
    return [];
  }

  return (data || []).map(mapDbSessionToSession);
}

// Helper to map database row to InterviewSession
function mapDbSessionToSession(row: any): InterviewSession {
  // Handle questions - Supabase JSONB returns as array or null
  let questions: any[] = [];
  
  if (row.questions) {
    if (Array.isArray(row.questions)) {
      questions = row.questions;
    } else if (typeof row.questions === 'string') {
      try {
        questions = JSON.parse(row.questions);
      } catch (e) {
        logger.error('Failed to parse questions string', e instanceof Error ? e : new Error(String(e)), { sessionId: row.id });
        questions = [];
      }
    } else {
      questions = [];
    }
  }

  return {
    id: row.id,
    mode: row.mode,
    createdAt: new Date(row.created_at).getTime(),
    resumeText: row.resume_text || '',
    jdText: row.jd_text || undefined,
    role: row.role || undefined,
    level: row.level || undefined,
    status: row.status,
    questions: questions,
    currentQuestionIndex: row.current_question_index || 0,
    answers: Array.isArray(row.answers) ? row.answers : [],
    evaluations: Array.isArray(row.evaluations) ? row.evaluations : [],
    scoreSummary: row.score_summary || {
      countEvaluated: 0,
      avg: { technical: 0, communication: 0, problemSolving: 0, overall: 0 },
    },
    report: row.report || undefined,
    shareToken: row.share_token || undefined,
    jobSetup: row.job_setup || undefined,
    collegeJobTemplateId: row.college_job_template_id || undefined,
    candidateEmail: row.candidate_email || undefined,
    candidateName: row.candidate_name || undefined,
    studentId: row.student_id || undefined,
    tabSwitchCount: row.tab_switch_count || 0,
    tabSwitchEvents: Array.isArray(row.tab_switch_events) ? row.tab_switch_events : [],
    presence: row.presence || undefined,
  };
}

// ============================================
// COLLEGE STORE (Supabase)
// ============================================

export async function createTemplate(template: CollegeJobTemplate): Promise<CollegeJobTemplate> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from(TABLES.TEMPLATES)
    .insert({
      id: template.id,
      college_id: template.collegeId || null,
      created_by: template.createdBy || null,
      jd_text: template.jdText,
      top_skills: template.topSkills,
      config: template.config,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating template', error instanceof Error ? error : new Error(String(error)), { templateId: template.id });
    throw error;
  }

  await logAudit('template_created', 'college_job_template', template.id);

  return mapDbTemplateToTemplate(data);
}

export async function getTemplate(id: string): Promise<CollegeJobTemplate | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(TABLES.TEMPLATES)
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    logger.error('Error getting template', error instanceof Error ? error : new Error(String(error)), { templateId: id });
    return null;
  }

  return mapDbTemplateToTemplate(data);
}

export async function getAllTemplates(): Promise<CollegeJobTemplate[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLES.TEMPLATES)
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error getting all templates', error instanceof Error ? error : new Error(String(error)));
    return [];
  }

  return (data || []).map(mapDbTemplateToTemplate);
}

export async function createBatch(batch: CandidateBatch): Promise<CandidateBatch> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase not configured');
  }

  const { data: batchData, error: batchError } = await supabase
    .from(TABLES.BATCHES)
    .insert({
      id: batch.id,
      job_template_id: batch.jobTemplateId,
    })
    .select()
    .single();

  if (batchError) {
    logger.error('Error creating batch', batchError instanceof Error ? batchError : new Error(String(batchError)), { batchId: batch.id });
    throw batchError;
  }

  // Insert candidates
  const candidatesToInsert = batch.candidates.map(c => ({
    batch_id: batch.id,
    email: c.email,
    name: c.name,
    student_id: c.studentId || null,
    session_id: c.sessionId || null,
    status: c.status || 'pending',
    completed_at: c.completedAt ? new Date(c.completedAt).toISOString() : null,
    link_sent_at: c.linkSentAt ? new Date(c.linkSentAt).toISOString() : null,
  }));

  const { error: candidatesError } = await supabase
    .from(TABLES.BATCH_CANDIDATES)
    .insert(candidatesToInsert);

  if (candidatesError) {
    logger.error('Error creating batch candidates', candidatesError instanceof Error ? candidatesError : new Error(String(candidatesError)), { batchId: batch.id, candidateCount: batch.candidates.length });
    throw candidatesError;
  }

  await logAudit('batch_created', 'candidate_batch', batch.id, {
    template_id: batch.jobTemplateId,
    candidate_count: batch.candidates.length,
  });

  return batch;
}

export async function getBatch(id: string): Promise<CandidateBatch | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data: batchData, error: batchError } = await supabase
    .from(TABLES.BATCHES)
    .select('*')
    .eq('id', id)
    .single();

  if (batchError) {
    if (batchError.code === 'PGRST116') {
      return null;
    }
    logger.error('Error getting batch', batchError instanceof Error ? batchError : new Error(String(batchError)), { batchId: id });
    return null;
  }

  const { data: candidatesData, error: candidatesError } = await supabase
    .from(TABLES.BATCH_CANDIDATES)
    .select('*')
    .eq('batch_id', id);

  if (candidatesError) {
    logger.error('Error getting batch candidates', candidatesError instanceof Error ? candidatesError : new Error(String(candidatesError)), { batchId: id });
    return null;
  }

  return {
    id: batchData.id,
    jobTemplateId: batchData.job_template_id,
    createdAt: new Date(batchData.created_at).getTime(),
    candidates: (candidatesData || []).map(c => ({
      email: c.email,
      name: c.name,
      studentId: c.student_id || undefined,
      sessionId: c.session_id || undefined,
      status: c.status || 'pending',
      completedAt: c.completed_at ? new Date(c.completed_at).getTime() : undefined,
      linkSentAt: c.link_sent_at ? new Date(c.link_sent_at).getTime() : undefined,
    })),
  };
}

export async function getBatchesByTemplate(templateId: string): Promise<CandidateBatch[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const { data: batchesData, error: batchesError } = await supabase
    .from(TABLES.BATCHES)
    .select('*')
    .eq('job_template_id', templateId)
    .order('created_at', { ascending: false });

  if (batchesError) {
    logger.error('Error getting batches', batchesError instanceof Error ? batchesError : new Error(String(batchesError)), { templateId });
    return [];
  }

  // Get candidates for each batch
  const batches: CandidateBatch[] = [];
  for (const batch of batchesData || []) {
    const { data: candidatesData } = await supabase
      .from(TABLES.BATCH_CANDIDATES)
      .select('*')
      .eq('batch_id', batch.id);

    batches.push({
      id: batch.id,
      jobTemplateId: batch.job_template_id,
      createdAt: new Date(batch.created_at).getTime(),
      candidates: (candidatesData || []).map(c => ({
        email: c.email,
        name: c.name,
        studentId: c.student_id || undefined,
        sessionId: c.session_id || undefined,
        status: c.status || 'pending',
        completedAt: c.completed_at ? new Date(c.completed_at).getTime() : undefined,
        linkSentAt: c.link_sent_at ? new Date(c.link_sent_at).getTime() : undefined,
      })),
    });
  }

  return batches;
}

function mapDbTemplateToTemplate(row: any): CollegeJobTemplate {
  return {
    id: row.id,
    collegeId: row.college_id || undefined,
    createdAt: new Date(row.created_at).getTime(),
    createdBy: row.created_by || undefined,
    jdText: row.jd_text,
    topSkills: row.top_skills || [],
    config: row.config || { questionCount: 10, difficultyCurve: 'balanced' },
  };
}

// Audit logging
export async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, any>
): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    return;
  }

  try {
    await supabase.from(TABLES.AUDIT_LOGS).insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details || {},
    });
  } catch (error) {
    logger.warn('Failed to log audit', { error: error instanceof Error ? error.message : String(error), action, entityType, entityId });
  }
}
