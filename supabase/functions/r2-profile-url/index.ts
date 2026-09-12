import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import {
  GetObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3"

import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner"

import { createClient } from "npm:@supabase/supabase-js@2"

/* ==========================================================================
   CONFIGURATION
   ========================================================================== */

const SIGNED_URL_EXPIRES_IN =
  60 * 60 // 1 hour

const R2_ORGANIZATION_ID =
  Deno.env.get("R2_ORGANIZATION_ID") ??
  "default"

/* ==========================================================================
   ENVIRONMENT
   ========================================================================== */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ??
  ""

const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get(
    "SUPABASE_PUBLISHABLE_KEY",
  ) ??
  ""

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  ) ??
  Deno.env.get(
    "SUPABASE_SECRET_KEY",
  ) ??
  ""

const R2_ACCOUNT_ID =
  Deno.env.get("R2_ACCOUNT_ID") ??
  ""

const R2_ACCESS_KEY_ID =
  Deno.env.get(
    "R2_ACCESS_KEY_ID",
  ) ?? ""

const R2_SECRET_ACCESS_KEY =
  Deno.env.get(
    "R2_SECRET_ACCESS_KEY",
  ) ?? ""

const R2_BUCKET_NAME =
  Deno.env.get(
    "R2_BUCKET_NAME",
  ) ??
  "xyphora-prime-documents"

const R2_ENDPOINT =
  Deno.env.get("R2_ENDPOINT") ||
  (
    R2_ACCOUNT_ID
      ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : ""
  )

/* ==========================================================================
   CORS
   ========================================================================== */

const DEFAULT_ALLOWED_ORIGINS =
  [
    /*
     * Production
     */
    "https://xyphoraprimemanagement.com",
    "https://www.xyphoraprimemanagement.com",

    /*
     * Development
     */
    "http://localhost:5173",
    "https://localhost:5173",
    "http://localhost:8443",
    "https://localhost:8443",
  ]

const configuredOrigins =
  (
    Deno.env.get(
      "CORS_ORIGINS",
    ) ?? ""
  )
    .split(",")
    .map((origin) =>
      origin.trim(),
    )
    .filter(Boolean)

const allowedOrigins =
  new Set<string>([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...configuredOrigins,
  ])

function getCorsHeaders(
  request: Request,
): Record<string, string> {
  const origin =
    request.headers.get(
      "Origin",
    ) ?? ""

  const headers: Record<
    string,
    string
  > = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Access-Control-Max-Age":
      "86400",
    "Vary":
      "Origin",
  }

  /*
   * Only allow explicitly configured origins.
   *
   * Never return a random fallback origin.
   */
  if (
    origin &&
    allowedOrigins.has(origin)
  ) {
    headers[
      "Access-Control-Allow-Origin"
    ] = origin
  }

  return headers
}

/* ==========================================================================
   RESPONSE HELPERS
   ========================================================================== */

function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...getCorsHeaders(
          request,
        ),
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "no-store",
      },
    },
  )
}

function errorResponse(
  request: Request,
  message: string,
  status = 400,
): Response {
  return jsonResponse(
    request,
    {
      success: false,
      error: message,
    },
    status,
  )
}

/* ==========================================================================
   ENVIRONMENT VALIDATION
   ========================================================================== */

function validateEnvironment(): void {
  const missing: string[] = []

  if (!SUPABASE_URL) {
    missing.push(
      "SUPABASE_URL",
    )
  }

  if (!SUPABASE_ANON_KEY) {
    missing.push(
      "SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY",
    )
  }

  if (
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    missing.push(
      "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY",
    )
  }

  if (!R2_ACCOUNT_ID) {
    missing.push(
      "R2_ACCOUNT_ID",
    )
  }

  if (!R2_ACCESS_KEY_ID) {
    missing.push(
      "R2_ACCESS_KEY_ID",
    )
  }

  if (
    !R2_SECRET_ACCESS_KEY
  ) {
    missing.push(
      "R2_SECRET_ACCESS_KEY",
    )
  }

  if (!R2_BUCKET_NAME) {
    missing.push(
      "R2_BUCKET_NAME",
    )
  }

  if (!R2_ENDPOINT) {
    missing.push(
      "R2_ENDPOINT",
    )
  }

  if (
    missing.length > 0
  ) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    )
  }
}

/* ==========================================================================
   SUPABASE CLIENTS
   ========================================================================== */

/**
 * Client using the caller's JWT.
 *
 * This client is only used to validate the authenticated user.
 */
function createUserClient(
  request: Request,
) {
  const authorization =
    request.headers.get(
      "Authorization",
    ) ?? ""

  return createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization:
            authorization,
        },
      },
      auth: {
        persistSession:
          false,
        autoRefreshToken:
          false,
      },
    },
  )
}

/**
 * Service-role client.
 *
 * Used only after authentication.
 */
function createServiceClient() {
  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession:
          false,
        autoRefreshToken:
          false,
      },
    },
  )
}

/* ==========================================================================
   R2 CLIENT
   ========================================================================== */

function createR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId:
        R2_ACCESS_KEY_ID,
      secretAccessKey:
        R2_SECRET_ACCESS_KEY,
    },
  })
}

/* ==========================================================================
   UUID VALIDATION
   ========================================================================== */

function isValidUUID(
  value: string,
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

/* ==========================================================================
   AUTHENTICATION
   ========================================================================== */

async function authenticate(
  request: Request,
) {
  const authorization =
    request.headers.get(
      "Authorization",
    )

  if (
    !authorization ||
    !authorization
      .toLowerCase()
      .startsWith(
        "bearer ",
      )
  ) {
    throw new AuthError(
      "Missing authentication token.",
    )
  }

  const token =
    authorization
      .slice(7)
      .trim()

  if (!token) {
    throw new AuthError(
      "Missing authentication token.",
    )
  }

  const supabase =
    createUserClient(
      request,
    )

  /*
   * Explicitly pass the JWT.
   */
  const {
    data,
    error,
  } =
    await supabase.auth.getUser(
      token,
    )

  if (
    error ||
    !data.user
  ) {
    console.error(
      "Authentication failed:",
      error,
    )

    throw new AuthError(
      "Invalid or expired authentication session.",
    )
  }

  return data.user
}

/* ==========================================================================
   AUTHORIZATION
   ========================================================================== */

async function authorize(
  userId: string,
) {
  const supabase =
    createServiceClient()

  const {
    data: profile,
    error,
  } =
    await supabase
      .from("profiles")
      .select(
        "id, role, status",
      )
      .eq(
        "id",
        userId,
      )
      .maybeSingle()

  if (error) {
    console.error(
      "Profile authorization lookup failed:",
      error,
    )

    throw new Error(
      "Unable to verify account permissions.",
    )
  }

  if (!profile) {
    throw new AuthorizationError(
      "User profile was not found.",
    )
  }

  /*
   * Inactive accounts cannot access employee
   * profile images.
   */
  if (
    profile.status &&
    profile.status !==
      "Active"
  ) {
    throw new AuthorizationError(
      "Your account is inactive.",
    )
  }

  const role =
    String(
      profile.role ?? "",
    )
      .trim()
      .toLowerCase()

  /*
   * Employee profile images are private company data.
   */
  const allowedRoles =
    new Set([
      "admin",
      "manager",
      "accountant",
    ])

  if (
    !allowedRoles.has(
      role,
    )
  ) {
    throw new AuthorizationError(
      "You do not have permission to view employee profile images.",
    )
  }

  return profile
}

/* ==========================================================================
   EMPLOYEE LOOKUP
   ========================================================================== */

async function getEmployee(
  employeeId: string,
) {
  const supabase =
    createServiceClient()

  const {
    data: employee,
    error,
  } =
    await supabase
      .from("employees")
      .select(
        "id, employee_id, full_name, avatar_url",
      )
      .eq(
        "id",
        employeeId,
      )
      .maybeSingle()

  if (error) {
    console.error(
      "Employee lookup failed:",
      error,
    )

    throw new Error(
      "Unable to load the employee record.",
    )
  }

  if (!employee) {
    throw new Error(
      "Employee record was not found.",
    )
  }

  return employee
}

/* ==========================================================================
   EMPLOYEE AVATAR KEY VALIDATION
   ========================================================================== */

/**
 * Expected R2 object:
 *
 * organizations/default/employees/<employee UUID>/avatar-xxxx.webp
 *
 * or:
 *
 * organizations/<organization ID>/employees/<employee UUID>/avatar-xxxx.webp
 */
function isValidEmployeeAvatarKey(
  key: string,
  employeeId: string,
): boolean {
  if (!key) {
    return false
  }

  /*
   * Expected prefix.
   */
  const expectedPrefix =
    `organizations/${R2_ORGANIZATION_ID}/employees/${employeeId}/avatar-`

  if (
    !key.startsWith(
      expectedPrefix,
    )
  ) {
    return false
  }

  /*
   * Prevent path traversal.
   */
  if (
    key.includes("..") ||
    key.includes("\\")
  ) {
    return false
  }

  /*
   * Prevent control characters.
   */
  if (
    /[\u0000-\u001F\u007F]/.test(
      key,
    )
  ) {
    return false
  }

  /*
   * Reject URLs.
   */
  if (
    key.includes("://") ||
    key.startsWith("/") ||
    key.startsWith(
      "http://",
    ) ||
    key.startsWith(
      "https://",
    )
  ) {
    return false
  }

  /*
   * Only image files.
   */
  if (
    !/\.(jpg|jpeg|png|webp|gif)$/i.test(
      key,
    )
  ) {
    return false
  }

  /*
   * Reasonable key length.
   */
  if (
    key.length > 500
  ) {
    return false
  }

  return true
}

/* ==========================================================================
   CUSTOM ERRORS
   ========================================================================== */

class AuthError extends Error {
  constructor(
    message: string,
  ) {
    super(message)
    this.name =
      "AuthError"
  }
}

class AuthorizationError
  extends Error {
  constructor(
    message: string,
  ) {
    super(message)
    this.name =
      "AuthorizationError"
  }
}

/* ==========================================================================
   MAIN EDGE FUNCTION
   ========================================================================== */

Deno.serve(
  async (
    request: Request,
  ): Promise<Response> => {
    /*
     * ================================================================
     * CORS PREFLIGHT
     * ================================================================
     *
     * IMPORTANT:
     *
     * OPTIONS must be handled BEFORE authentication.
     */

    if (
      request.method ===
      "OPTIONS"
    ) {
      const origin =
        request.headers.get(
          "Origin",
        )

      /*
       * Reject unknown browser origins.
       */
      if (
        origin &&
        !allowedOrigins.has(
          origin,
        )
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Origin not allowed.",
          }),
          {
            status: 403,
            headers: {
              ...getCorsHeaders(
                request,
              ),
              "Content-Type":
                "application/json; charset=utf-8",
            },
          },
        )
      }

      return new Response(
        null,
        {
          status: 204,
          headers:
            getCorsHeaders(
              request,
            ),
        },
      )
    }

    /*
     * ================================================================
     * METHOD VALIDATION
     * ================================================================
     */

    if (
      request.method !==
      "POST"
    ) {
      return errorResponse(
        request,
        "Method not allowed.",
        405,
      )
    }

    /*
     * ================================================================
     * ORIGIN VALIDATION
     * ================================================================
     */

    const origin =
      request.headers.get(
        "Origin",
      )

    if (
      origin &&
      !allowedOrigins.has(
        origin,
      )
    ) {
      return errorResponse(
        request,
        "Origin not allowed.",
        403,
      )
    }

    try {
      /*
       * ==============================================================
       * ENVIRONMENT
       * ==============================================================
       */

      validateEnvironment()

      /*
       * ==============================================================
       * AUTHENTICATION
       * ==============================================================
       */

      const user =
        await authenticate(
          request,
        )

      /*
       * ==============================================================
       * AUTHORIZATION
       * ==============================================================
       */

      await authorize(
        user.id,
      )

      /*
       * ==============================================================
       * REQUEST BODY
       * ==============================================================
       */

      let body: unknown

      try {
        body =
          await request.json()
      } catch {
        return errorResponse(
          request,
          "Invalid JSON request body.",
          400,
        )
      }

      if (
        !body ||
        typeof body !==
          "object" ||
        Array.isArray(body)
      ) {
        return errorResponse(
          request,
          "Invalid request body.",
          400,
        )
      }

      const requestBody =
        body as {
          employee_id?: unknown
        }

      /*
       * ==============================================================
       * EMPLOYEE ID
       * ==============================================================
       */

      const employeeId =
        typeof requestBody.employee_id ===
        "string"
          ? requestBody.employee_id.trim()
          : ""

      if (!employeeId) {
        return errorResponse(
          request,
          "employee_id is required.",
          400,
        )
      }

      /*
       * employees.id is a UUID.
       */
      if (
        !isValidUUID(
          employeeId,
        )
      ) {
        return errorResponse(
          request,
          "Invalid employee_id.",
          400,
        )
      }

      /*
       * ==============================================================
       * LOAD EMPLOYEE
       * ==============================================================
       */

      const employee =
        await getEmployee(
          employeeId,
        )

      /*
       * ==============================================================
       * NO AVATAR
       * ==============================================================
       *
       * This is a normal state.
       */

      if (
        !employee.avatar_url
      ) {
        return jsonResponse(
          request,
          {
            success: true,
            has_avatar: false,

            employee_id:
              employee.id,

            employee_code:
              employee.employee_id,

            employee_name:
              employee.full_name,

            avatar_url:
              null,

            url:
              null,

            signed_url:
              null,

            expires_in:
              0,
          },
        )
      }

      /*
       * ==============================================================
       * AVATAR OBJECT KEY
       * ==============================================================
       */

      const objectKey =
        String(
          employee.avatar_url,
        ).trim()

      if (!objectKey) {
        return jsonResponse(
          request,
          {
            success: true,
            has_avatar: false,

            employee_id:
              employee.id,

            employee_code:
              employee.employee_id,

            employee_name:
              employee.full_name,

            avatar_url:
              null,

            url:
              null,

            signed_url:
              null,

            expires_in:
              0,
          },
        )
      }

      /*
       * ==============================================================
       * SECURITY VALIDATION
       * ==============================================================
       */

      if (
        !isValidEmployeeAvatarKey(
          objectKey,
          employee.id,
        )
      ) {
        console.error(
          "Rejected employee avatar key:",
          {
            employeeId:
              employee.id,
            objectKey,
          },
        )

        return errorResponse(
          request,
          "The employee profile image path is invalid.",
          400,
        )
      }

      /*
       * ==============================================================
       * R2 CLIENT
       * ==============================================================
       */

      const r2 =
        createR2Client()

      /*
       * ==============================================================
       * SIGNED URL
       * ==============================================================
       */

      let signedUrl: string

      try {
        /*
         * IMPORTANT:
         *
         * Do not force ResponseContentType to "image/*".
         * The R2 object already has the correct Content-Type
         * from the upload operation.
         */

        const command =
          new GetObjectCommand({
            Bucket:
              R2_BUCKET_NAME,

            Key:
              objectKey,

            /*
             * Browser-friendly private caching.
             */
            ResponseCacheControl:
              "private, max-age=3600",
          })

        signedUrl =
          await getSignedUrl(
            r2,
            command,
            {
              expiresIn:
                SIGNED_URL_EXPIRES_IN,
            },
          )
      } catch (r2Error) {
        console.error(
          "Failed to generate employee avatar signed URL:",
          r2Error,
        )

        throw new Error(
          "Unable to generate the employee profile image URL.",
        )
      }

      /*
       * ==============================================================
       * SUCCESS
       * ==============================================================
       */

      return jsonResponse(
        request,
        {
          success: true,

          has_avatar: true,

          employee_id:
            employee.id,

          employee_code:
            employee.employee_id,

          employee_name:
            employee.full_name,

          /*
           * PRIVATE R2 OBJECT KEY.
           *
           * This is NOT a public URL.
           */
          avatar_url:
            objectKey,

          /*
           * TEMPORARY SIGNED URL.
           */
          url:
            signedUrl,

          signed_url:
            signedUrl,

          /*
           * URL lifetime in seconds.
           */
          expires_in:
            SIGNED_URL_EXPIRES_IN,
        },
        200,
      )
    } catch (error) {
      /*
       * ==============================================================
       * ERROR HANDLING
       * ==============================================================
       */

      console.error(
        "employee-url function error:",
        error,
      )

      /*
       * Authentication error.
       */
      if (
        error instanceof
        AuthError
      ) {
        return errorResponse(
          request,
          error.message,
          401,
        )
      }

      /*
       * Permission error.
       */
      if (
        error instanceof
        AuthorizationError
      ) {
        return errorResponse(
          request,
          error.message,
          403,
        )
      }

      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."

      /*
       * Don't expose server configuration
       * details to the browser.
       */
      const safeMessage =
        message.startsWith(
          "Missing required environment variables:",
        ) ||
        message.endsWith(
          "is not configured",
        )
          ? "The server is not correctly configured."
          : message

      return errorResponse(
        request,
        safeMessage,
        500,
      )
    }
  },
)