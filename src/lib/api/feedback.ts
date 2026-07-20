import { GREENROOM_API_BASE } from "@/config/greenroomApi";
import { greenroomFetch } from "@/lib/api/client";

// User-submitted bug reports / feedback. Any authenticated user can create one
// (optionally scoped to a domain app); admins list and resolve them from the
// Admin Portal. Endpoints live in the users Lambda under /users/feedback/...
// (see backend api/views/feedback.py). Mirrors src/lib/api/users.ts.

// The four domain apps reuse their exact AppIds; "general" is the catch-all.
// Kept in sync with the CHECK constraint in scripts/sql/feedback.sql.
export const FEEDBACK_APP_CONTEXTS = [
  "incoming-offers",
  "pitch",
  "active-projects",
  "archive",
  "general",
] as const;
export type FeedbackAppContext = (typeof FEEDBACK_APP_CONTEXTS)[number];

export type FeedbackStatus = "open" | "resolved";

export interface FeedbackReport {
  id: number;
  submitter_user_id: number;
  submitter_username: string | null;
  submitter_email: string | null;
  app_context: FeedbackAppContext;
  message: string;
  status: FeedbackStatus;
  date_created: string;
  date_last_updated: string;
}

export interface CreateFeedbackPayload {
  message: string;
  app_context: FeedbackAppContext;
  // Fallback identity used only while REQUIRE_AUTH is off (dev / anonymous).
  // In prod the authenticated bearer token identifies the submitter.
  user_id?: number;
}

interface CreateFeedbackResponse {
  id: number;
  status: FeedbackStatus;
  message: string;
}

interface FeedbackListResponse {
  feedback: FeedbackReport[];
}

async function parseError(response: Response, fallback: string): Promise<string> {
  const error = await response
    .json()
    .catch(() => ({ error: response.statusText }));
  return error.error || fallback;
}

// Open to any authenticated user. POST /users/feedback/.
export async function createFeedback(
  payload: CreateFeedbackPayload
): Promise<CreateFeedbackResponse> {
  const response = await greenroomFetch(`${GREENROOM_API_BASE}/users/feedback/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to submit feedback"));
  }
  return await response.json();
}

// Admin only (server-enforced). GET /users/feedback/list/.
export async function getFeedback(): Promise<FeedbackReport[]> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/users/feedback/list/`
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to fetch feedback"));
  }
  const data: FeedbackListResponse = await response.json();
  return data.feedback;
}

// Admin only (server-enforced). PATCH /users/feedback/<id>/.
export async function updateFeedbackStatus(
  id: number,
  status: FeedbackStatus
): Promise<{ id: number; status: FeedbackStatus }> {
  const response = await greenroomFetch(
    `${GREENROOM_API_BASE}/users/feedback/${id}/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseError(response, "Failed to update feedback"));
  }
  return await response.json();
}
