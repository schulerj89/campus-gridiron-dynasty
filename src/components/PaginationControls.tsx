import { ChevronLeft, ChevronRight } from "lucide-react";

export function PaginationControls({
  page,
  pageCount,
  total,
  pageSize,
  label,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  label: string;
  onPageChange: (page: number) => void;
}) {
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="pagination" data-testid={`${label}-pagination`}>
      <span>
        {label}: {start}-{end} of {total}
      </span>
      <div>
        <button className="icon-button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label={`Previous ${label} page`}>
          <ChevronLeft size={17} />
        </button>
        <strong>
          Page {page} / {Math.max(1, pageCount)}
        </strong>
        <button className="icon-button" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount} aria-label={`Next ${label} page`}>
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
