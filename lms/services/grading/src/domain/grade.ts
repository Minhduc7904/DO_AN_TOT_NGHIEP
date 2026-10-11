export interface Grade {
  id: string;
  submission_id: string;
  principal_id: string;
  course_id: string;
  score: number;
  completed_at: string;
}

export interface GradeRepresentation {
  id: string;
  submission_id: string;
  score: number;
  completed_at: string;
}

export function toGradeRepresentation(grade: Grade): GradeRepresentation {
  return {
    completed_at: grade.completed_at,
    id: grade.id,
    score: grade.score,
    submission_id: grade.submission_id,
  };
}
