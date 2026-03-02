import { GREENROOM_API_BASE } from "@/config/greenroomApi";

export interface Pitch {
  id: number;
  title: string;
  description: string;
  status: string;
  project_id: number | null;
  submitter_user_id: number;
  date_submitted: string;
  date_closed: string | null;
  total_votes?: number;
  yes_votes?: number;
}

export interface PitchDetail extends Pitch {
  votes: PitchVote[];
  comments: PitchComment[];
}

export interface PitchVote {
  user_id: number;
  username: string;
  vote_value: number;
  comment: string | null;
}

export interface PitchComment {
  id: number;
  user_id: number;
  username: string;
  comment: string;
  parent_comment_id: number | null;
  date_created: string;
}

export interface CreatePitchPayload {
  submitter_user_id: number;
  title: string;
  description?: string;
  status?: string;
  project_id?: number | null;
}

export interface UpdatePitchPayload {
  title?: string;
  description?: string;
  status?: string;
  submitter_user_id?: number;
  project_id?: number | null;
}

export interface VotePayload {
  user_id: number;
  vote_value: number;
  comment?: string;
}

export interface CommentPayload {
  user_id: number;
  comment: string;
  parent_comment_id?: number | null;
}

export interface PitchesListResponse {
  pitches: Pitch[];
}

export interface PitchDetailResponse {
  pitch: Pitch;
  votes: PitchVote[];
  comments: PitchComment[];
}

export interface PitchMetadata {
  keyDates?: string;
  venue?: string;
  budget?: string;
  timelines?: string;
}

const METADATA_SEPARATOR = "\n\n---\n\n";

export function serializePitchDescription(
  description: string,
  metadata: PitchMetadata
): string {
  if (!metadata.keyDates && !metadata.venue && !metadata.budget && !metadata.timelines) {
    return description;
  }

  const metadataParts: string[] = [];
  if (metadata.keyDates) metadataParts.push(`**Key Dates:** ${metadata.keyDates}`);
  if (metadata.venue) metadataParts.push(`**Venue/Location:** ${metadata.venue}`);
  if (metadata.budget) metadataParts.push(`**Budget:** ${metadata.budget}`);
  if (metadata.timelines) metadataParts.push(`**Timelines:** ${metadata.timelines}`);

  return `${description}${METADATA_SEPARATOR}${metadataParts.join("\n")}`;
}

export function parsePitchDescription(
  fullDescription: string
): { description: string; metadata: PitchMetadata } {
  if (!fullDescription.includes(METADATA_SEPARATOR)) {
    return { description: fullDescription, metadata: {} };
  }

  const [description, metadataBlock] = fullDescription.split(METADATA_SEPARATOR, 2);
  const metadata: PitchMetadata = {};

  if (metadataBlock) {
    const keyDatesMatch = metadataBlock.match(/\*\*Key Dates:\*\* (.+)/);
    const venueMatch = metadataBlock.match(/\*\*Venue\/Location:\*\* (.+)/);
    const budgetMatch = metadataBlock.match(/\*\*Budget:\*\* (.+)/);
    const timelinesMatch = metadataBlock.match(/\*\*Timelines:\*\* (.+)/);

    if (keyDatesMatch) metadata.keyDates = keyDatesMatch[1].trim();
    if (venueMatch) metadata.venue = venueMatch[1].trim();
    if (budgetMatch) metadata.budget = budgetMatch[1].trim();
    if (timelinesMatch) metadata.timelines = timelinesMatch[1].trim();
  }

  return { description: description.trim(), metadata };
}

export async function getPitches(): Promise<Pitch[]> {
  const response = await fetch(`${GREENROOM_API_BASE}/pitches/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch pitches: ${response.statusText}`);
  }
  const data: PitchesListResponse = await response.json();
  return data.pitches;
}

export async function getPitchById(id: number): Promise<PitchDetail> {
  const response = await fetch(`${GREENROOM_API_BASE}/pitches/${id}/`);
  if (!response.ok) {
    throw new Error(`Failed to fetch pitch ${id}: ${response.statusText}`);
  }
  const data: PitchDetailResponse = await response.json();
  return {
    ...data.pitch,
    votes: data.votes,
    comments: data.comments,
  };
}

export async function createPitch(payload: CreatePitchPayload): Promise<Pitch> {
  const response = await fetch(`${GREENROOM_API_BASE}/pitches/create/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to create pitch: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

export async function updatePitch(
  id: number,
  payload: UpdatePitchPayload
): Promise<{ message: string; pitch_id: number }> {
  const response = await fetch(`${GREENROOM_API_BASE}/pitches/${id}/update/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to update pitch: ${response.statusText}`);
  }
  return await response.json();
}

export async function deletePitch(id: number): Promise<{ message: string }> {
  const response = await fetch(`${GREENROOM_API_BASE}/pitches/${id}/delete/`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to delete pitch: ${response.statusText}`);
  }
  return await response.json();
}

export async function voteOnPitch(
  id: number,
  payload: VotePayload
): Promise<{ message: string; vote_id: number; vote_value: number }> {
  const response = await fetch(`${GREENROOM_API_BASE}/pitches/${id}/vote/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to vote on pitch: ${response.statusText}`);
  }
  return await response.json();
}

export async function addComment(
  id: number,
  payload: CommentPayload
): Promise<{ message: string; comment_id: number }> {
  const response = await fetch(`${GREENROOM_API_BASE}/pitches/${id}/comments/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to add comment: ${response.statusText}`);
  }
  return await response.json();
}

