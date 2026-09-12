import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "npm:@supabase/supabase-js@2"

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3"

/* ==========================================================================
   CONFIGURATION
   ========================================================================== */

const MAX_FILE_SIZE =
  5 * 1024 * 1024 // 5 MB

const ALLOWED_MIME_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ])

const ALLOWED_EXTENSIONS:
  Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  }

/* ==========================================================================
   ENVIRONMENT
   ========================================================================== */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? ""

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
  Deno.env.get("R2_ACCOUNT_ID") ?? ""

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
    Vary: "Origin",
  }

  /*
   * Only return Access-Control-Allow-Origin when the
   * requesting origin is explicitly trusted.
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

function getRequiredEnv(
  name: string,
): string {
  const value =
    Deno.env.get(name)

  if (!value) {
    throw new Error(
      `${name} is not configured`,
    )
  }

  return value
}

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
   SUPABASE CLIENT
   ========================================================================== */

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
   PROFILE
   ========================================================================== */

async function getProfile(
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
        "id, avatar_url, role, status",
      )
      .eq(
        "id",
        userId,
      )
      .maybeSingle()

  if (error) {
    console.error(
      "Profile lookup failed:",
      error,
    )

    throw new Error(
      "Unable to load your profile.",
    )
  }

  if (!profile) {
    throw new AuthorizationError(
      "Profile not found.",
    )
  }

  /*
   * Inactive users cannot upload or delete
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

  return profile
}

/* ==========================================================================
   FILE HELPERS
   ========================================================================== */

function getExtension(
  mimeType: string,
): string {
  return (
    ALLOWED_EXTENSIONS[
      mimeType
    ] ?? "webp"
  )
}

/* ==========================================================================
   PROFILE R2 KEY VALIDATION
   ========================================================================== */

function isOwnedProfileObject(
  key: string,
  userId: string,
): boolean {
  if (!key) {
    return false
  }

  /*
   * Expected:
   *
   * profiles/{user-id}/avatar-{uuid}.jpg
   *
   * or png/webp/gif.
   */
  const prefix =
    `profiles/${userId}/avatar-`

  if (
    !key.startsWith(prefix)
  ) {
    return false
  }

  /*
   * Prevent traversal.
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
      "http",
    )
  ) {
    return false
  }

  /*
   * Only allow image extensions.
   */
  if (
    !/\.(jpg|jpeg|png|webp|gif)$/i.test(
      key,
    )
  ) {
    return false
  }

  /*
   * Prevent unexpectedly large object keys.
   */
  if (
    key.length > 500
  ) {
    return false
  }

  return true
}

/* ==========================================================================
   DELETE R2 OBJECT
   ========================================================================== */

async function deleteR2Object(
  r2: S3Client,
  bucket: string,
  key: string,
): Promise<void> {
  await r2.send(
    new DeleteObjectCommand(
      {
        Bucket: bucket,
        Key: key,
      },
    ),
  )
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
     * OPTIONS must be answered before authentication.
     *
     * Otherwise the browser will report a CORS error instead of
     * exposing the actual authentication response.
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
     * ================================================================
     * METHOD
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
       * PROFILE
       * ==============================================================
       */

      const profile =
        await getProfile(
          user.id,
        )

      /*
       * ==============================================================
       * SERVICE CLIENT
       * ==============================================================
       */

      const supabaseAdmin =
        createServiceClient()

      /*
       * ==============================================================
       * R2
       * ==============================================================
       */

      const bucket =
        getRequiredEnv(
          "R2_BUCKET_NAME",
        )

      const r2 =
        createR2Client()

      /*
       * ==============================================================
       * CONTENT TYPE
       * ==============================================================
       */

      const contentType =
        request.headers.get(
          "content-type",
        ) ?? ""

      /*
       * ==============================================================
       * JSON DELETE REQUEST
       * ==============================================================
       *
       * Delete requests may send JSON:
       *
       * {
       *   "action": "delete"
       * }
       *
       * Upload requests must use multipart/form-data.
       */

      if (
        contentType
          .toLowerCase()
          .includes(
            "application/json",
          )
      ) {
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
            action?: unknown
          }

        const action =
          typeof requestBody.action ===
          "string"
            ? requestBody.action
                .trim()
                .toLowerCase()
            : ""

        if (
          action !==
          "delete"
        ) {
          return errorResponse(
            request,
            "Invalid request action.",
            400,
          )
        }

        /*
         * ============================================================
         * DELETE PROFILE IMAGE
         * ============================================================
         */

        const oldAvatarUrl =
          profile.avatar_url

        /*
         * Nothing to remove.
         */

        if (
          !oldAvatarUrl
        ) {
          return jsonResponse(
            request,
            {
              success: true,
              message:
                "No profile image to remove.",
              avatar_url:
                null,
            },
          )
        }

        /*
         * Only delete an object that belongs to the
         * authenticated user's profile namespace.
         */

        if (
          isOwnedProfileObject(
            oldAvatarUrl,
            user.id,
          )
        ) {
          try {
            await deleteR2Object(
              r2,
              bucket,
              oldAvatarUrl,
            )
          } catch (
            deleteError
          ) {
            /*
             * Log the storage problem, but still attempt
             * to clear the database reference.
             */

            console.error(
              "Failed to delete old profile image from R2:",
              deleteError,
            )
          }
        } else {
          /*
           * Do not delete arbitrary objects.
           */

          console.warn(
            "Profile avatar path is outside the user's R2 namespace. Database reference will still be cleared.",
          )
        }

        /*
         * Clear database reference.
         */

        const {
          error:
            updateError,
        } =
          await supabaseAdmin
            .from(
              "profiles",
            )
            .update({
              avatar_url:
                null,
            })
            .eq(
              "id",
              user.id,
            )

        if (
          updateError
        ) {
          console.error(
            "Failed to clear avatar_url:",
            updateError,
          )

          return errorResponse(
            request,
            "The profile image could not be removed from your profile.",
            500,
          )
        }

        return jsonResponse(
          request,
          {
            success: true,
            message:
              "Profile image removed successfully.",
            avatar_url:
              null,
          },
        )
      }

      /*
       * ==============================================================
       * UPLOAD REQUEST
       * ==============================================================
       */

      if (
        !contentType
          .toLowerCase()
          .includes(
            "multipart/form-data",
          )
      ) {
        return errorResponse(
          request,
          "Request must use multipart/form-data for image uploads.",
          400,
        )
      }

      /*
       * ==============================================================
       * FORM DATA
       * ==============================================================
       */

      const formData =
        await request.formData()

      /*
       * ==============================================================
       * ACTION
       * ==============================================================
       */

      const actionValue =
        formData.get(
          "action",
        )

      const action =
        typeof actionValue ===
        "string"
          ? actionValue
              .trim()
              .toLowerCase()
          : "upload"

      if (
        action !==
        "upload"
      ) {
        return errorResponse(
          request,
          "Invalid upload action.",
          400,
        )
      }

      /*
       * ==============================================================
       * FILE
       * ==============================================================
       *
       * Support:
       *   file
       *   avatar
       *   image
       */

      const fileFields = [
        "file",
        "avatar",
        "image",
      ]

      let file:
        | File
        | null = null

      for (
        const fieldName of fileFields
      ) {
        const value =
          formData.get(
            fieldName,
          )

        if (
          value instanceof File
        ) {
          file = value
          break
        }
      }

      if (!file) {
        return errorResponse(
          request,
          "No profile image was provided.",
          400,
        )
      }

      /*
       * ==============================================================
       * MIME TYPE
       * ==============================================================
       */

      const mimeType =
        file.type
          .trim()
          .toLowerCase()

      if (
        !ALLOWED_MIME_TYPES.has(
          mimeType,
        )
      ) {
        return errorResponse(
          request,
          "Invalid image type. Please upload JPG, PNG, WEBP, or GIF.",
          400,
        )
      }

      /*
       * ==============================================================
       * FILE SIZE
       * ==============================================================
       */

      if (
        file.size <= 0
      ) {
        return errorResponse(
          request,
          "The selected image is empty.",
          400,
        )
      }

      if (
        file.size >
        MAX_FILE_SIZE
      ) {
        return errorResponse(
          request,
          "Profile image must be 5 MB or smaller.",
          400,
        )
      }

      /*
       * ==============================================================
       * READ FILE
       * ==============================================================
       */

      const fileBuffer =
        await file.arrayBuffer()

      /*
       * ==============================================================
       * CREATE PRIVATE R2 OBJECT KEY
       * ==============================================================
       *
       * Example:
       *
       * profiles/
       *   1702f304-.../
       *     avatar-550e8400-e29b-41d4-a716-446655440000.webp
       */

      const extension =
        getExtension(
          mimeType,
        )

      const objectKey =
        `profiles/${user.id}/avatar-${crypto.randomUUID()}.${extension}`

      /*
       * ==============================================================
       * UPLOAD TO CLOUDFLARE R2
       * ==============================================================
       */

      try {
        await r2.send(
          new PutObjectCommand(
            {
              Bucket: bucket,
              Key: objectKey,
              Body: new Uint8Array(
                fileBuffer,
              ),
              ContentType:
                mimeType,
              ContentLength:
                file.size,

              /*
               * Keep this object private.
               */
              CacheControl:
                "private, max-age=3600",
            },
          ),
        )
      } catch (uploadError) {
        console.error(
          "R2 profile image upload failed:",
          uploadError,
        )

        return errorResponse(
          request,
          "Failed to upload the profile image.",
          500,
        )
      }

      /*
       * ==============================================================
       * SAVE R2 KEY TO PROFILE
       * ==============================================================
       *
       * IMPORTANT:
       *
       * avatar_url contains the PRIVATE R2 object key.
       *
       * It does NOT contain a public R2 URL.
       */

      const oldAvatarUrl =
        profile.avatar_url

      const {
        error:
          updateError,
      } =
        await supabaseAdmin
          .from("profiles")
          .update({
            avatar_url:
              objectKey,
          })
          .eq(
            "id",
            user.id,
          )

      /*
       * ==============================================================
       * DATABASE UPDATE FAILED
       * ==============================================================
       *
       * Remove the newly uploaded R2 object so we don't
       * create an orphaned storage object.
       */

      if (
        updateError
      ) {
        console.error(
          "Failed to update profile avatar_url:",
          updateError,
        )

        try {
          await deleteR2Object(
            r2,
            bucket,
            objectKey,
          )
        } catch (
          cleanupError
        ) {
          console.error(
            "Failed to clean up new R2 object:",
            cleanupError,
          )
        }

        return errorResponse(
          request,
          "Profile image was uploaded but could not be linked to your profile.",
          500,
        )
      }

      /*
       * ==============================================================
       * DELETE OLD IMAGE
       * ==============================================================
       *
       * Only delete the previous object after the database
       * successfully points to the new object.
       */

      if (
        oldAvatarUrl &&
        oldAvatarUrl !==
          objectKey &&
        isOwnedProfileObject(
          oldAvatarUrl,
          user.id,
        )
      ) {
        try {
          await deleteR2Object(
            r2,
            bucket,
            oldAvatarUrl,
          )
        } catch (
          deleteError
        ) {
          /*
           * The new avatar is already active.
           *
           * Don't fail the request because an old
           * unused object could not be deleted.
           */

          console.error(
            "Failed to delete previous profile image:",
            deleteError,
          )
        }
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
          message:
            "Profile image uploaded successfully.",

          /*
           * Private R2 object key.
           */
          avatar_url:
            objectKey,

          file_name:
            file.name,

          file_type:
            mimeType,

          file_size:
            file.size,
        },
        200,
      )
    } catch (error) {
      /*
       * ==============================================================
       * GLOBAL ERROR HANDLER
       * ==============================================================
       */

      console.error(
        "r2-profile-upload error:",
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
       * Don't expose infrastructure configuration
       * details to the browser.
       */

      const safeMessage =
        message.startsWith(
          "Missing required environment variables:",
        ) ||
        message.includes(
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