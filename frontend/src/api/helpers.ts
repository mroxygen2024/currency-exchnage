export type QueryPrimitive = string | number | boolean | Date | null | undefined;
export type QueryValue = QueryPrimitive | QueryPrimitive[];
export type QueryParams = Record<string, QueryValue>;

const isDate = (value: unknown): value is Date => value instanceof Date;

export const toIsoString = (value: Date | string | null | undefined): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (isDate(value)) {
    return value.toISOString();
  }

  return value;
};

export const normalizeQueryParams = <T extends QueryParams>(params?: T): Record<string, string | number | boolean> => {
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      if (value === null || value === undefined) {
        return [];
      }

      if (Array.isArray(value)) {
        return value.flatMap((item) => {
          if (item === null || item === undefined) {
            return [];
          }

          if (item instanceof Date) {
            return [[key, item.toISOString()] as const];
          }

          return [[key, item] as const];
        });
      }

      if (value instanceof Date) {
        return [[key, value.toISOString()] as const];
      }

      return [[key, value] as const];
    })
  );
};

export const formatDateQueryParams = <T extends { start_date?: Date | string; end_date?: Date | string }>(params?: T): T | undefined => {
  if (!params) {
    return undefined;
  }

  return {
    ...params,
    start_date: toIsoString(params.start_date),
    end_date: toIsoString(params.end_date),
  } as T;
};

export const createSessionExpiredEvent = (): CustomEvent => new CustomEvent('auth:session-expired');

export const dispatchSessionExpiredEvent = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(createSessionExpiredEvent());
};