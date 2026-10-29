import axios, { AxiosError } from 'axios';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

type ApiErrorBody = { error?: string; details?: { path: string; message: string }[] };

/** Human-readable message for any API/network error. */
export function errorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error) return body.error;
    if (err.response?.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
    if (!err.response) return 'Cannot reach the server. Check your internet connection.';
  }
  return 'Something went wrong. Please try again.';
}

/** Field-level validation errors keyed by path, e.g. "customer.phone". */
export function fieldErrors(err: unknown): Record<string, string> {
  if (err instanceof AxiosError) {
    const body = err.response?.data as ApiErrorBody | undefined;
    return Object.fromEntries((body?.details ?? []).map((d) => [d.path, d.message]));
  }
  return {};
}
