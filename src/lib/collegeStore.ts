import { CollegeJobTemplate, CandidateBatch } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __COLLEGE_TEMPLATE_STORE__: Map<string, CollegeJobTemplate> | undefined;
  // eslint-disable-next-line no-var
  var __COLLEGE_BATCH_STORE__: Map<string, CandidateBatch> | undefined;
}

const templateStore = globalThis.__COLLEGE_TEMPLATE_STORE__ ?? new Map<string, CollegeJobTemplate>();
globalThis.__COLLEGE_TEMPLATE_STORE__ = templateStore;

const batchStore = globalThis.__COLLEGE_BATCH_STORE__ ?? new Map<string, CandidateBatch>();
globalThis.__COLLEGE_BATCH_STORE__ = batchStore;

export function createTemplate(template: CollegeJobTemplate) {
  templateStore.set(template.id, template);
  return template;
}

export function getTemplate(id: string) {
  return templateStore.get(id) ?? null;
}

export function getAllTemplates(): CollegeJobTemplate[] {
  return Array.from(templateStore.values());
}

export function createBatch(batch: CandidateBatch) {
  batchStore.set(batch.id, batch);
  return batch;
}

export function getBatch(id: string) {
  return batchStore.get(id) ?? null;
}

export function getBatchesByTemplate(templateId: string): CandidateBatch[] {
  return Array.from(batchStore.values()).filter(b => b.jobTemplateId === templateId);
}

