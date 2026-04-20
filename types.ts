export enum ConversionStatus {
  IDLE = 'IDLE',
  AWAITING_ACTION = 'AWAITING_ACTION',
  READING = 'READING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface FormFieldDef {
  id: string;
  name: string;
  label: string;
  type: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AIAnalysisReport {
  suggestedNames: string[];
  summary: string;
  mergeStrategies: string;
}

export interface ProcessedFile {
  id: string;
  originalName: string;
  markdownName: string;
  content: string;
  originalSize: number;
  status: ConversionStatus;
  errorMessage?: string;
  timestamp: number;
  pdfUrl?: string; // Standard PDF URL
  fillablePdfUrl?: string; // Auto-generated fillable PDF URL
  formFields?: FormFieldDef[]; // Easy fill fields from AI
  aiReport?: AIAnalysisReport;
  images?: string[];
  rawFile?: File;
  performedAction?: string;
}