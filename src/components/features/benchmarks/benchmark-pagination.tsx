import {
  PaginationControls,
  type PaginationControlsProps,
} from "@/components/shared/common/pagination-controls";

export type BenchmarkPaginationProps = PaginationControlsProps;

export function BenchmarkPagination(props: BenchmarkPaginationProps) {
  return <PaginationControls {...props} />;
}