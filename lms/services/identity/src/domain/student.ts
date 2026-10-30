export const STUDENT_STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export interface Student {
  id: string;
  email: string;
  fullName: string;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
}
