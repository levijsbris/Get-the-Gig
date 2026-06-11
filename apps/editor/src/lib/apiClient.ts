import { firebaseAuth } from './firebase';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ProblemDetails | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
  correlationId?: string;
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  anonymous?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, anonymous, ...rest } = options;
  const headers = new Headers(rest.headers);

  if (!anonymous) {
    const user = firebaseAuth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...rest, headers, body: payload });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const problem = isProblemDetails(parsed) ? parsed : undefined;
    throw new ApiError(response.status, problem, problem?.title ?? response.statusText);
  }
  return parsed as T;
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('title' in value || 'status' in value || 'detail' in value)
  );
}
