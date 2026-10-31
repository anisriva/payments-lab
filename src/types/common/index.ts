import { LucideProps } from 'lucide-react';
export type IconType = React.ForwardRefExoticComponent<
  Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
>;
import type { PaginationResult } from '@/types/common/pagination';

// Types for better type safety
export type RouteType = 'platform' | 'project';

// /src/types/common/index.ts
export type ApiErrorResponse = { success: false; error: string; code?: string };

export type ApiResponse<T = unknown> = { success: true; data?: T } | ApiErrorResponse;

export type PaginatedApiResponse<T> = ({ success: true } & PaginationResult<T>) | ApiErrorResponse;
