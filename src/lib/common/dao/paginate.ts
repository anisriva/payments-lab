import { DEFAULT_PAGINATION, PaginationInput, PaginationResult } from '@/types/common/pagination';

/** Minimal structural contract every Prisma delegate satisfies. */
interface PrismaModelDelegate {
  findMany(args?: unknown): Promise<unknown>;
  count(args?: unknown): Promise<number>;
}

interface PaginateParams<TWhereInput, TOrderByInput> {
  where: TWhereInput;
  orderBy: TOrderByInput;
  /** Defaults to DEFAULT_PAGINATION when omitted. */
  pagination?: PaginationInput;
  include?: unknown; // validated by Prisma at runtime
  select?: unknown; // validated by Prisma at runtime
}

/**
 * Shared pagination mechanics. Caller owns where/orderBy/include/select
 * and declares the return type.
 *
 * ⚠️ Runs findMany and count in parallel. Do NOT call with a
 * transaction-scoped delegate — Prisma does not support concurrent
 * queries inside interactive transactions. Paginated reads belong
 * outside transactions; in-transaction reads should query Prisma directly.
 *
 * @example
 * return paginate<
 *   BlogPostWithRelations,
 *   Prisma.BlogPostWhereInput,
 *   Prisma.BlogPostOrderByWithRelationInput
 * >(this.prisma.blogPost, { where, orderBy, pagination, include: blogPostListInclude });
 */
export async function paginate<TModel, TWhereInput, TOrderByInput>(
  delegate: PrismaModelDelegate,
  params: PaginateParams<TWhereInput, TOrderByInput>
): Promise<PaginationResult<TModel>> {
  const { where, orderBy, include, select } = params;

  if (include !== undefined && select !== undefined) {
    throw new Error(
      'paginate(): `include` and `select` are mutually exclusive in Prisma — pass one or the other.'
    );
  }

  const { page, limit } = params.pagination ?? DEFAULT_PAGINATION;
  const skip = (page - 1) * limit;

  const findManyArgs: {
    where?: TWhereInput;
    skip: number;
    take: number;
    orderBy?: TOrderByInput;
    include?: unknown;
    select?: unknown;
  } = { where, skip, take: limit, orderBy };

  if (include !== undefined) findManyArgs.include = include;
  if (select !== undefined) findManyArgs.select = select;

  const [data, total] = await Promise.all([
    // Single boundary cast: TModel is caller-declared by design;
    // Prisma validates the args shape at runtime.
    delegate.findMany(findManyArgs) as Promise<TModel[]>,
    delegate.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
