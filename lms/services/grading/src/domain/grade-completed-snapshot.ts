/** Snapshot bất biến của grade tại thời điểm hoàn tất, đủ để dựng event `grade.completed` v1. */
export interface GradeCompletedSnapshot {
  eventId: string;
  gradeId: string;
  submissionId: string;
  principalId: string;
  courseId: string;
  score: number;
  completedAt: string;
}
