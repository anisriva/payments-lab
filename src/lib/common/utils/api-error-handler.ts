import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getZodErrorMessage, log } from '@/lib/common/utils';
import type { ApiErrorResponse } from '@/types/common';

/**
 * Maps custom service error names to HTTP status codes.
 * Services stay HTTP-agnostic (they throw domain errors, per service.md);
 * this map is the ONLY place domain errors meet HTTP.
 * Add a row here when you add a custom error class.
 */
const ERROR_STATUS_BY_NAME: Record<string, number> = {
  // 400 — bad input / validation errors
  ValidationError: 400,
  MissingFieldError: 400,
  InvalidFieldError: 400,
  InvalidRequestError: 400,
  ThemeValidationError: 400,
  InvalidPresetError: 400,
  CannotRemoveOwnerError: 400,
  PaymentValidationError: 400,
  ProviderNotImplementedError: 400,
  InvalidPaymentSignatureError: 400,
  InvalidCreditAmountError: 400,
  NoPaymentProviderAvailableError: 400,
  GatewayCredentialsRejectedError: 400,
  GatewayCountryNotSupportedError: 400,
  InvalidOfferingError: 400,
  OfferingNotPurchasableError: 400,
  AmountBelowMinimumError: 400,
  ProviderSettingInvalidError: 400,
  NoCreditRateForCurrencyError: 400,
  InvalidPlanPriceError: 400,
  ActiveSubscriptionExistsError: 409,
  CurrencyNotSupportedError: 400,
  PaymentCapabilityNotSupportedError: 400,
  InvalidCredentialsInputError: 400,
  InvalidPaymentFlowError: 400,

  // 401 — unauthenticated
  UnauthenticatedError: 401,
  AuthError: 401,

  // 403 — authenticated but not allowed
  UnauthorizedError: 403,
  UnauthorizedAccessError: 403,
  UnauthorizedProjectAccessError: 403,
  NotProjectOwnerError: 403,
  NotProjectMemberError: 403,
  FeatureLimitExceededError: 403,
  FeatureNotAvailableError: 403,
  ModuleNotEnabledError: 403,
  PlanLimitExceededError: 403,
  ForbiddenException: 403,
  InsufficientCreditsError: 403,

  // 404 — not found
  ResourceNotFoundError: 404,
  ProjectNotFoundError: 404,
  MemberNotFoundError: 404,
  ThemeNotFoundError: 404,
  BlogPostNotFoundError: 404,
  BlogCategoryNotFoundError: 404,
  BlogTagNotFoundError: 404,
  BlogCommentNotFoundError: 404,
  NotFoundException: 404,
  ProviderEventNotFoundError: 404,
  PlanPriceNotFoundError: 404,
  CreditPurchaseNotFoundError: 404,
  PlatformSubscriptionNotFoundError: 404,
  PaymentConnectionNotFoundError: 404,
  OfferingNotFoundError: 404,
  ProjectOrderNotFoundError: 404,
  ProjectSubscriptionNotFoundError: 404,
  CountryNotFoundError: 404,
  CreditRateNotFoundError: 404,
  UnsupportedWebhookProviderError: 404,

  // 409 — conflict / duplicate
  ResourceExistsError: 409,
  SubdomainTakenError: 409,
  ProjectNameTakenError: 409,
  ThemeNameExistsError: 409,
  CategoryExistsError: 409,
  SlugExistsError: 409,
  MemberAlreadyExistsError: 409,
  NewOwnerNotMemberError: 409,
  NoImportToUndoError: 409,
  PaymentNotStartedError: 409,
  GatewayNotConnectedError: 409,
  PaymentConnectionDisabledError: 409,
  CreditRateExistsError: 409,
  PlanPriceExistsError: 409,
  PlanPriceInUseError: 409,
  ProjectInUseError: 409,
  OfferingInUseError: 409,

  // 502 — upstream provider failure
  PaymentProviderError: 502,

  // 422 — unprocessable input (client shows a typed problem card via `code`)
  CvImportError: 422,
  PaymentRequestRejectedError: 422,

  // 503 — server-side configuration / unavailable
  AiFeatureUnavailableError: 503,
  ModelNotFoundError: 503,
};

/**
 * Shared route error handler
 * Converts domain errors to HTTP responses with proper status codes
 *
 * @param error - The error to handle
 * @param context - Context string for logging (e.g., 'GET /api/platform/projects')
 * @returns NextResponse with ApiResponse structure
 */
export function handleRouteError(error: unknown, context: string): NextResponse<ApiErrorResponse> {
  // Always log — full details go to logs, never to the client on 500
  log(`${context} error`, error, 'error');

  // Malformed JSON body from request.json() → 400, not 500
  if (error instanceof SyntaxError) {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Zod validation failures → 400 with formatted message
  if (error instanceof ZodError) {
    return NextResponse.json({ success: false, error: getZodErrorMessage(error) }, { status: 400 });
  }

  // Known domain errors → mapped status, domain message is safe to expose
  if (error instanceof Error) {
    const status = ERROR_STATUS_BY_NAME[error.name];
    if (status) {
      // Typed errors carry `code` (CvImportError); the rest fall back to the
      // error name so clients can still branch on e.g. InsufficientCreditsError.
      const code =
        'code' in error && typeof (error as { code: unknown }).code === 'string'
          ? (error as { code: string }).code
          : error.name;
      return NextResponse.json({ success: false, error: error.message, code }, { status });
    }

    // Handle Prisma errors with specific error codes
    if ('code' in error) {
      const prismaError = error as { code: string; meta?: Record<string, unknown> };

      // P2002: Unique constraint violation (409 Conflict)
      if (prismaError.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'A record with this value already exists' },
          { status: 409 }
        );
      }

      // P2003: Foreign key constraint violation (409 Conflict)
      if (prismaError.code === 'P2003') {
        return NextResponse.json(
          { success: false, error: 'Cannot delete: This item is referenced by other records' },
          { status: 409 }
        );
      }

      // P2025: Record not found (404 Not Found)
      if (prismaError.code === 'P2025') {
        return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
      }
    }
  }

  // Everything else → generic 500. NEVER expose error.message here —
  // Prisma errors, constraint names, and stack details must not leak.
  return NextResponse.json({ success: false, error: 'Something went wrong' }, { status: 500 });
}
