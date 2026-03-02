export interface ApiEndpoint {
  id: string;
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  category: string;
  description?: string;
  requiresId?: boolean;
  queryParams?: Array<{
    name: string;
    required: boolean;
    description?: string;
  }>;
  bodyFields?: Array<{
    name: string;
    required: boolean;
    type: string;
    description?: string;
  }>;
}

export interface ApiRequest {
  endpoint: ApiEndpoint;
  id?: string;
  queryParams: Record<string, string>;
  body: Record<string, unknown>;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
  time: number;
}



