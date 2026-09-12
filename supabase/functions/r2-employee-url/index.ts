import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import {
  GetObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3"

import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner"

import { createClient } from "npm:@supabase/supabase-js@2"

/* ==========================================================================
   ENVIRONMENT
   ========================================================================== */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? ""

const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  ""

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  ""

const R2_ACCOUNT_ID =
  Deno.env.get("R2_ACCOUNT_ID") ?? ""

const R2_ACCESS_KEY_ID =
  Deno.env.get("R2_ACCESS_KEY_ID") ?? ""

const R2_SECRET_ACCESS_KEY =
  Deno.env.get("R2_SECRET_ACCESS_KEY") ?? ""

const R2_BUCKET_NAME =
  Deno.env.get("R2_BUCKET_NAME") ??
  "xyphora-prime-documents"

const R2_ENDPOINT =
  Deno.env.get("R2_ENDPOINT") ||
  (
    R2_ACCOUNT_ID
      ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : ""
  )

const R2_ORGANIZATION_ID =
  Deno.env.get("R2_ORGANIZATION_ID") ??
  "default"

/*
 * Private signed URL lifetime.
 *
 * 1 hour is enough for the employee-management UI
 * while keeping the R2 bucket private.
 */
const SIGNED_URL_EXPIRES_IN =
  60 * 60

/* ==========================================================================
   CORS
   ========================================================================== */

const configuredOrigins = (
  Deno.env.get("CORS_ORIGINS") ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

const allowedOrigins =
  new Set<string>([
    "https://xyphoraprimemanagement.com",
    "https://www.xyphoraprimemanagement.com",

    "http://localhost:5173",
    "https://localhost:5173",

    "http://localhost:8443",
    "https://localhost:8443",

    ...configuredOrigins,
  ])

function getCorsHeaders(
  request: Request,
): HeadersInit {
  const origin =
    request.headers.get("Origin") ?? ""

  const headers: HeadersInit = {
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
   * Never use Access-Control-Allow-Origin: *
   * with authenticated requests.
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
        ...getCorsHeaders(request),
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
  status: number,
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
    missing.push("SUPABASE_URL")
  }

  if (!SUPABASE_ANON_KEY) {
    missing.push(
      "SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY",
    )
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    missing.push(
      "SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY",
    )
  }

  if (!R2_ACCOUNT_ID) {
    missing.push("R2_ACCOUNT_ID")
  }

  if (!R2_ACCESS_KEY_ID) {
    missing.push("R2_ACCESS_KEY_ID")
  }

  if (!R2_SECRET_ACCESS_KEY) {
    missing.push("R2_SECRET_ACCESS_KEY")
  }

  if (!R2_BUCKET_NAME) {
    missing.push("R2_BUCKET_NAME")
  }

  if (!R2_ENDPOINT) {
    missing.push("R2_ENDPOINT")
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    )
  }
}

/* ==========================================================================
   SUPABASE CLIENTS
   ========================================================================== */

/**
 * Creates a Supabase client using the authenticated
 * user's Authorization header.
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
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}

/**
 * Service-role client.
 *
 * This client is only used after the request
 * has successfully passed authentication.
 */
function createServiceClient() {
  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
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
    !authorization.startsWith(
      "Bearer ",
    )
  ) {
    throw new AuthError(
      "Missing authentication token.",
    )
  }

  const token =
    authorization.slice(7).trim()

  if (!token) {
    throw new AuthError(
      "Missing authentication token.",
    )
  }

  const supabase =
    createUserClient(request)

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
      .eq("id", userId)
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

  if (
    profile.status &&
    profile.status !== "Active"
  ) {
    throw new AuthorizationError(
      "Your account is inactive.",
    )
  }

  /*
   * Employee profile images contain private
   * company information.
   *
   * Only authorized management/accounting roles
   * can request signed employee image URLs.
   */
  const allowedRoles =
    new Set([
      "admin",
      "manager",
      "accountant",
    ])

  const role =
    String(profile.role ?? "")
      .trim()
      .toLowerCase()

  if (
    !allowedRoles.has(role)
  ) {
    throw new AuthorizationError(
      "You do not have permission to view employee profile images.",
    )
  }

  return profile
}

/* ==========================================================================
   EMPLOYEE UUID VALIDATION
   ========================================================================== */

function isValidUUID(
  value: string,
): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
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
      .eq("id", employeeId)
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
   EMPLOYEE AVATAR PATH VALIDATION
   ========================================================================== */

function isValidEmployeeAvatarKey(
  key: string,
  employeeId: string,
): boolean {
  /*
   * Expected structure:
   *
   * organizations/default/employees/<employee-uuid>/avatar-xxxxx.webp
   *
   * Or:
   *
   * organizations/<organization-id>/employees/<employee-uuid>/avatar-xxxxx.webp
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
   * Prevent newline/control-character injection.
   */
  if (
    /[\u0000-\u001F\u007F]/.test(
      key,
    )
  ) {
    return false
  }

  /*
   * Prevent URLs from being stored/reused
   * as R2 object keys.
   */
  if (
    key.includes("://") ||
    key.startsWith("/") ||
    key.startsWith("http")
  ) {
    return false
  }

  /*
   * Employee avatar must be an image.
   */
  if (
    !/\.(jpg|jpeg|png|webp)$/i.test(
      key,
    )
  ) {
    return false
  }

  /*
   * Keep object keys reasonably bounded.
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
    this.name = "AuthError"
  }
}

class AuthorizationError extends Error {
  constructor(
    message: string,
  ) {
    super(message)
    this.name =
      "AuthorizationError"
  }
}

/* ==========================================================================
   MAIN HANDLER
   ========================================================================== */

Deno.serve(
  async (
    request: Request,
  ): Promise<Response> => {
    /*
     * ------------------------------------------------------------
     * CORS PREFLIGHT
     * ------------------------------------------------------------
     *
     * IMPORTANT:
     * OPTIONS must be handled before authentication.
     */
    if (
      request.method ===
      "OPTIONS"
    ) {
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
     * ------------------------------------------------------------
     * METHOD VALIDATION
     * ------------------------------------------------------------
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

    try {
      /*
       * ----------------------------------------------------------
       * ENVIRONMENT
       * ----------------------------------------------------------
       */

      validateEnvironment()

      /*
       * ----------------------------------------------------------
       * AUTHENTICATION
       * ----------------------------------------------------------
       */

      const user =
        await authenticate(
          request,
        )

      /*
       * ----------------------------------------------------------
       * AUTHORIZATION
       * ----------------------------------------------------------
       */

      await authorize(
        user.id,
      )

      /*
       * ----------------------------------------------------------
       * REQUEST BODY
       * ----------------------------------------------------------
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
       * ----------------------------------------------------------
       * EMPLOYEE ID
       * ----------------------------------------------------------
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
       * ----------------------------------------------------------
       * EMPLOYEE LOOKUP
       * ----------------------------------------------------------
       */

      const employee =
        await getEmployee(
          employeeId,
        )

      /*
       * ----------------------------------------------------------
       * NO PROFILE IMAGE
       * ----------------------------------------------------------
       *
       * This is a valid state.
       *
       * The frontend should display employee initials
       * or its default avatar.
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
          200,
        )
      }

      /*
       * ----------------------------------------------------------
       * R2 OBJECT KEY
       * ----------------------------------------------------------
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
          200,
        )
      }

      /*
       * ----------------------------------------------------------
       * SECURITY VALIDATION
       * ----------------------------------------------------------
       *
       * Never allow the client to request an arbitrary
       * R2 object.
       */
      if (
        !isValidEmployeeAvatarKey(
          objectKey,
          employee.id,
        )
      ) {
        console.error(
          "Rejected invalid employee avatar key:",
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
       * ----------------------------------------------------------
       * R2 CLIENT
       * ----------------------------------------------------------
       */

      const r2 =
        createR2Client()

      /*
       * ----------------------------------------------------------
       * GENERATE SIGNED URL
       * ----------------------------------------------------------
       */

      let signedUrl: string

      try {
        signedUrl =
          await getSignedUrl(
            r2,
            new GetObjectCommand(
              {
                Bucket:
                  R2_BUCKET_NAME,

                Key:
                  objectKey,
              },
            ),
            {
              expiresIn:
                SIGNED_URL_EXPIRES_IN,
            },
          )
      } catch (r2Error) {
        console.error(
          "R2 signed URL generation failed:",
          r2Error,
        )

        throw new Error(
          "Unable to generate the employee profile image URL.",
        )
      }

      /*
       * ----------------------------------------------------------
       * SUCCESS
       * ----------------------------------------------------------
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
           * This remains the PRIVATE R2 object key.
           * It is not a public URL.
           */
          avatar_url:
            objectKey,

          /*
           * Temporary signed URL used by the browser.
           */
          url:
            signedUrl,

          signed_url:
            signedUrl,

          expires_in:
            SIGNED_URL_EXPIRES_IN,
        },
        200,
      )
    } catch (error) {
      console.error(
        "employee-url function error:",
        error,
      )

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
       * Do not expose internal infrastructure
       * details to the browser.
       */
      const safeMessage =
        message.startsWith(
          "Missing required environment variables:",
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