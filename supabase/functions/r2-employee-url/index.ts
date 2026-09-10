import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import {
  S3Client,
  GetObjectCommand,
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
 * Signed URL lifetime.
 *
 * 1 hour gives the browser enough time to display
 * the image without exposing the R2 bucket publicly.
 */
const SIGNED_URL_EXPIRES_IN = 60 * 60

/* ==========================================================================
   CORS
   ========================================================================== */

const configuredOrigins = (
  Deno.env.get("CORS_ORIGINS") ?? ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

const allowedOrigins = new Set([
  "http://localhost:8443",
  "https://localhost:8443",
  "http://localhost:5173",
  "https://localhost:5173",
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
    "Vary": "Origin",
  }

  if (
    allowedOrigins.has(origin)
  ) {
    headers[
      "Access-Control-Allow-Origin"
    ] = origin
  }

  return headers
}

/* ==========================================================================
   RESPONSE
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
      },
    },
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
    missing.push(
      "R2_SECRET_ACCESS_KEY",
    )
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

/*
 * Authenticated user client.
 *
 * The incoming Authorization header is passed to
 * Supabase so getUser() validates the actual session.
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

/*
 * Service-role client.
 *
 * This is created only after the request has
 * been authenticated and authorized.
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

function createR2Client() {
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
    throw new Error(
      "Missing authentication token.",
    )
  }

  const supabase =
    createUserClient(request)

  const {
    data,
    error,
  } =
    await supabase.auth.getUser()

  if (
    error ||
    !data.user
  ) {
    console.error(
      "Authentication failed:",
      error,
    )

    throw new Error(
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
    throw new Error(
      "User profile was not found.",
    )
  }

  if (
    profile.status &&
    profile.status !== "Active"
  ) {
    throw new Error(
      "Your account is inactive.",
    )
  }

  /*
   * Employee images are currently being accessed
   * from the employee-management pages.
   *
   * These roles can access employee profile images.
   */
  const allowedRoles = new Set([
    "admin",
    "manager",
    "accountant",
  ])

  if (
    !allowedRoles.has(
      String(profile.role),
    )
  ) {
    throw new Error(
      "You do not have permission to view employee profile images.",
    )
  }

  return profile
}

/* ==========================================================================
   EMPLOYEE
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
   * organizations/default/employees/<employee-id>/avatar-xxxxx.webp
   *
   * or, when R2_ORGANIZATION_ID is configured:
   *
   * organizations/<organization-id>/employees/<employee-id>/avatar-xxxxx.webp
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
   * Prevent path traversal or unexpected
   * object references.
   */
  if (
    key.includes("..") ||
    key.includes("\\")
  ) {
    return false
  }

  /*
   * Employee avatar must have an image extension.
   */
  const validExtension =
    /\.(jpg|jpeg|png|webp)$/i.test(
      key,
    )

  if (!validExtension) {
    return false
  }

  return true
}

/* ==========================================================================
   MAIN
   ========================================================================== */

Deno.serve(
  async (
    request: Request,
  ) => {
    /*
     * ------------------------------------------------------------
     * CORS PREFLIGHT
     * ------------------------------------------------------------
     *
     * Must happen before authentication.
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
     * METHOD
     * ------------------------------------------------------------
     */
    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        request,
        {
          success: false,
          error:
            "Method not allowed.",
        },
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
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Invalid JSON request body.",
          },
          400,
        )
      }

      if (
        !body ||
        typeof body !==
          "object"
      ) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Invalid request body.",
          },
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
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "employee_id is required.",
          },
          400,
        )
      }

      if (
        employeeId.length >
        100
      ) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Invalid employee_id.",
          },
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
       * NO AVATAR
       * ----------------------------------------------------------
       *
       * This is not an error.
       *
       * The frontend can simply show initials.
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
            avatar_url: null,
            url: null,
            signed_url: null,
            expires_in: 0,
          },
          200,
        )
      }

      const objectKey =
        String(
          employee.avatar_url,
        ).trim()

      /*
       * ----------------------------------------------------------
       * SECURITY CHECK
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
          "Invalid employee avatar object key:",
          objectKey,
        )

        return jsonResponse(
          request,
          {
            success: false,
            error:
              "The employee profile image path is invalid.",
          },
          400,
        )
      }

      /*
       * ----------------------------------------------------------
       * R2 SIGNED URL
       * ----------------------------------------------------------
       */
      const r2 =
        createR2Client()

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
          "Failed to generate employee avatar signed URL:",
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
          avatar_url:
            objectKey,
          url: signedUrl,
          signed_url:
            signedUrl,
          expires_in:
            SIGNED_URL_EXPIRES_IN,
        },
        200,
      )
    } catch (error) {
      console.error(
        "r2-employee-url error:",
        error,
      )

      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."

      let status = 500

      if (
        message.includes(
          "authentication",
        ) ||
        message.includes(
          "authentication token",
        ) ||
        message.includes(
          "expired",
        ) ||
        message.includes(
          "Invalid or expired",
        )
      ) {
        status = 401
      } else if (
        message.includes(
          "permission",
        ) ||
        message.includes(
          "inactive",
        )
      ) {
        status = 403
      }

      return jsonResponse(
        request,
        {
          success: false,
          error: message,
        },
        status,
      )
    }
  },
)