const DEFAULT_PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Busca todos os registros paginando em blocos de 1000 linhas para evitar
 * truncamento silencioso pelo limite padrão do PostgREST/Supabase.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);
    if (error || !data || data.length === 0) {
      break;
    }
    all.push(...data);
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return all;
}
