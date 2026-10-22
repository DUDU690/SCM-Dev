export function getPagination(query: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function paginate<T>(total: number, data: T[], page: number, limit: number) {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
