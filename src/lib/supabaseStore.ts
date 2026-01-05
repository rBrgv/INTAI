import { supabase, isSupabaseConfigured, TABLES } from './supabase';
import { InterviewSession, CollegeJobTemplate, CandidateBatch } from './types';
import { logger } from './logger';

// ============================================
// SESSION STORE (Supabase)
// ============================================

export async function createSession(session: InterviewSession): Promise<InterviewSession> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
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

export async function getSession(id: string): Promise<InterviewSession | null> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.warn('Supabase not configured in getSession', { sessionId: id });
    return null;
  }

  logger.debug('Querying Supabase for session', { sessionId: id, table: TABLES.SESSIONS });
  
  const { data, error } = await supabase
    .from(TABLES.SESSIONS)
    .select('*')
    .eq('id', id)
    .single();

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
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  // Get current session
  const current = await getSession(id);
  if (!current) {
    logger.error('Cannot update: session not found', undefined, { sessionId: id });
    return null;
  }

  // Apply update
  const updated = updater(current);

  // Build update payload - ensure questions is always an array
  const questions = Array.isArray(updated.questions) ? updated.questions : [];

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
  const { data, error } = await supabase
    .from(TABLES.SESSIONS)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating session', new Error(error.message), { sessionId: id, errorCode: error.code });
    throw new Error(`Database update failed: ${error.message}`);
  }

  if (!data) {
    logger.error('No data returned from Supabase update', undefined, { sessionId: id });
    throw new Error('No data returned from update');
  }

  return mapDbSessionToSession(data);
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
