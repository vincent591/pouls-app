// Shape stored in Question.followUp (Prisma `Json?`). Kept as a plain type
// (not validated at the DB layer) since Prisma's Json column has no schema —
// src/app/api/questions/route.ts is the only writer.
export interface FollowUp {
  type: "choice" | "text";
  text: string;
  options?: string[];
}
