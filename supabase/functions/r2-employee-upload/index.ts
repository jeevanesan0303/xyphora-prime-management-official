import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "npm:@aws-sdk/client-s3"

import { createClient } from "npm:@supabase/supabase-js@2"

/* -------------------------------------------------------------------------- */
/* Environment                                                                */
/* -------------------------------------------------------------------------- */

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
  (R2_ACCOUNT_ID
    ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "")

const R2_ORGANIZATION_ID =
  Deno.env.get("R2_ORGANIZATION_ID") ??
  "default"

/* -------------------------------------------------------------------------- */
/* CORS                                                                       */
/* -------------------------------------------------------------------------- */

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

function corsHeaders(
  request: Request,
): HeadersInit {
  const origin =
    request.headers.get("Origin") ?? ""

  const headers: HeadersInit = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  }

  if (allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] =
      origin
  }

  return headers
}

function response(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders(request),
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  )
}

/* -------------------------------------------------------------------------- */
/* Supabase                                                                   */
/* -------------------------------------------------------------------------- */

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

function createAdminClient() {
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

/* -------------------------------------------------------------------------- */
/* R2                                                                         */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE =
  5 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
])

const ALLOWED_ROLES = new Set([
  "admin",
  "manager",
  "accountant",
])

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function validateEnvironment() {
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

  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    )
  }
}

async function authenticate(
  request: Request,
) {
  const authorization =
    request.headers.get(
      "Authorization",
    )

  if (
    !authorization?.startsWith(
      "Bearer ",
    )
  ) {
    throw new Error(
      "Missing authentication token.",
    )
  }

  const client =
    createUserClient(request)

  const {
    data,
    error,
  } =
    await client.auth.getUser()

  if (error || !data.user) {
    throw new Error(
      "Invalid or expired authentication session.",
    )
  }

  return data.user
}

async function authorize(
  userId: string,
) {
  const client =
    createAdminClient()

  const {
    data: profile,
    error,
  } =
    await client
      .from("profiles")
      .select(
        "id, role, status",
      )
      .eq("id", userId)
      .maybeSingle()

  if (error) {
    console.error(
      "Profile lookup failed:",
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

  if (
    !ALLOWED_ROLES.has(
      String(profile.role),
    )
  ) {
    throw new Error(
      "You do not have permission to manage employee photos.",
    )
  }

  return profile
}

async function getEmployee(
  employeeId: string,
) {
  const client =
    createAdminClient()

  const {
    data,
    error,
  } =
    await client
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

  if (!data) {
    throw new Error(
      "Employee record was not found.",
    )
  }

  return data
}

function getExtension(
  file: File,
): string {
  switch (
    file.type
      .toLowerCase()
      .trim()
  ) {
    case "image/jpeg":
      return "jpg"

    case "image/png":
      return "png"

    case "image/webp":
      return "webp"

    default:
      return "webp"
  }
}

function createAvatarKey(
  employeeId: string,
  extension: string,
): string {
  return [
    "organizations",
    R2_ORGANIZATION_ID,
    "employees",
    employeeId,
    `avatar-${crypto.randomUUID()}.${extension}`,
  ].join("/")
}

function isEmployeeAvatarKey(
  key: string,
  employeeId: string,
): boolean {
  const prefix =
    `organizations/${R2_ORGANIZATION_ID}/employees/${employeeId}/avatar-`

  return key.startsWith(prefix)
}

async function deleteR2Object(
  key: string,
) {
  const r2 =
    createR2Client()

  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  )
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

Deno.serve(
  async (
    request: Request,
  ) => {
    if (
      request.method === "OPTIONS"
    ) {
      return new Response(null, {
        status: 204,
        headers:
          corsHeaders(request),
      })
    }

    if (
      request.method !== "POST"
    ) {
      return response(
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
      validateEnvironment()

      const user =
        await authenticate(
          request,
        )

      await authorize(user.id)

      const contentType =
        request.headers
          .get("Content-Type")
          ?.toLowerCase() ?? ""

      /* -------------------------------------------------------------------- */
      /* DELETE                                                               */
      /* -------------------------------------------------------------------- */

      if (
        contentType.includes(
          "application/json",
        )
      ) {
        const body =
          await request.json()

        if (
          body?.action !==
          "delete"
        ) {
          return response(
            request,
            {
              success: false,
              error:
                "Unsupported action.",
            },
            400,
          )
        }

        const employeeId =
          typeof body.employee_id ===
          "string"
            ? body.employee_id.trim()
            : ""

        if (!employeeId) {
          return response(
            request,
            {
              success: false,
              error:
                "employee_id is required.",
            },
            400,
          )
        }

        const employee =
          await getEmployee(
            employeeId,
          )

        if (
          !employee.avatar_url
        ) {
          return response(
            request,
            {
              success: true,
              action: "deleted",
              employee_id:
                employeeId,
              avatar_url: null,
            },
          )
        }

        if (
          !isEmployeeAvatarKey(
            employee.avatar_url,
            employeeId,
          )
        ) {
          return response(
            request,
            {
              success: false,
              error:
                "The stored employee image path is invalid.",
            },
            400,
          )
        }

        /*
         * Delete R2 object.
         */
        try {
          await deleteR2Object(
            employee.avatar_url,
          )
        } catch (error) {
          console.error(
            "R2 delete failed:",
            error,
          )

          throw new Error(
            "Failed to remove employee photo from storage.",
          )
        }

        /*
         * Clear DB reference.
         */
        const client =
          createAdminClient()

        const {
          data:
            updatedEmployee,
          error:
            updateError,
        } =
          await client
            .from("employees")
            .update({
              avatar_url: null,
            })
            .eq(
              "id",
              employeeId,
            )
            .select(
              "id, employee_id, full_name, avatar_url",
            )
            .single()

        if (updateError) {
          console.error(
            "Failed to clear avatar_url:",
            updateError,
          )

          throw new Error(
            "Photo was removed from storage, but the employee record could not be updated.",
          )
        }

        return response(
          request,
          {
            success: true,
            action: "deleted",
            employee:
              updatedEmployee,
            employee_id:
              employeeId,
            avatar_url: null,
          },
        )
      }

      /* -------------------------------------------------------------------- */
      /* UPLOAD                                                               */
      /* -------------------------------------------------------------------- */

      if (
        !contentType.includes(
          "multipart/form-data",
        )
      ) {
        return response(
          request,
          {
            success: false,
            error:
              "Request must be multipart/form-data for uploads.",
          },
          415,
        )
      }

      const formData =
        await request.formData()

      const employeeIdValue =
        formData.get(
          "employee_id",
        )

      const employeeId =
        typeof employeeIdValue ===
        "string"
          ? employeeIdValue.trim()
          : ""

      if (!employeeId) {
        return response(
          request,
          {
            success: false,
            error:
              "employee_id is required.",
          },
          400,
        )
      }

      const file =
        formData.get("file")

      if (!(file instanceof File)) {
        return response(
          request,
          {
            success: false,
            error:
              "Please provide an employee profile image.",
          },
          400,
        )
      }

      if (file.size <= 0) {
        return response(
          request,
          {
            success: false,
            error:
              "The selected image is empty.",
          },
          400,
        )
      }

      if (
        file.size >
        MAX_FILE_SIZE
      ) {
        return response(
          request,
          {
            success: false,
            error:
              "Employee profile image must be smaller than 5 MB.",
          },
          400,
        )
      }

      const fileType =
        file.type
          .toLowerCase()
          .trim()

      if (
        !ALLOWED_TYPES.has(
          fileType,
        )
      ) {
        return response(
          request,
          {
            success: false,
            error:
              "Only JPG, PNG, and WEBP images are allowed.",
          },
          400,
        )
      }

      /*
       * Get employee before upload so we know
       * whether an old avatar exists.
       */
      const employee =
        await getEmployee(
          employeeId,
        )

      const extension =
        getExtension(file)

      const newKey =
        createAvatarKey(
          employeeId,
          extension,
        )

      const fileBuffer =
        await file.arrayBuffer()

      const r2 =
        createR2Client()

      /*
       * Upload new object.
       */
      try {
        await r2.send(
          new PutObjectCommand({
            Bucket:
              R2_BUCKET_NAME,
            Key: newKey,
            Body: fileBuffer,
            ContentType:
              fileType,
            CacheControl:
              "private, max-age=3600",
            Metadata: {
              "entity-type":
                "employee-avatar",
              "employee-id":
                employeeId,
            },
          }),
        )
      } catch (uploadError) {
        console.error(
          "Employee avatar R2 upload failed:",
          uploadError,
        )

        throw new Error(
          "Failed to upload employee profile image to storage.",
        )
      }

      /*
       * Update database.
       */
      const client =
        createAdminClient()

      const {
        data:
          updatedEmployee,
        error:
          updateError,
      } =
        await client
          .from("employees")
          .update({
            avatar_url: newKey,
          })
          .eq(
            "id",
            employeeId,
          )
          .select(
            "id, employee_id, full_name, avatar_url",
          )
          .single()

      /*
       * If DB update failed, remove the new
       * object to avoid an orphaned file.
       */
      if (updateError) {
        console.error(
          "Failed to update employee avatar_url:",
          updateError,
        )

        try {
          await deleteR2Object(
            newKey,
          )
        } catch (cleanupError) {
          console.error(
            "Failed to clean up new R2 object:",
            cleanupError,
          )
        }

        throw new Error(
          "Employee photo was uploaded, but the employee record could not be updated.",
        )
      }

      /*
       * Delete previous avatar only after
       * database update succeeds.
       */
      if (
        employee.avatar_url &&
        employee.avatar_url !==
          newKey &&
        isEmployeeAvatarKey(
          employee.avatar_url,
          employeeId,
        )
      ) {
        try {
          await deleteR2Object(
            employee.avatar_url,
          )
        } catch (oldDeleteError) {
          /*
           * The new image is already active.
           *
           * Do not fail the request because
           * an old object could not be removed.
           */
          console.error(
            "Failed to delete previous employee avatar:",
            oldDeleteError,
          )
        }
      }

      return response(
        request,
        {
          success: true,
          action: "uploaded",
          employee:
            updatedEmployee,
          object_key: newKey,
          avatar_url: newKey,
        },
      )
    } catch (error) {
      console.error(
        "r2-employee-upload:",
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

      return response(
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