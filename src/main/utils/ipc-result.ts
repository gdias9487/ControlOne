import type { ApiResult } from '../../shared/types';

export function ok<T>(data: T): ApiResult<T> {
  return { success: true, data };
}

export function fail(error: string, code?: string): ApiResult<never> {
  return { success: false, error, code };
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocorreu um erro inesperado.';
}

export async function handleIpc<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
