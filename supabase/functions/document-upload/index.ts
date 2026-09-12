import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "npm:@supabase/supabase-js@2"

import {
  S3Client,
  PutObjectCommand,
} from "npm:@aws-sdk/client-s3"

import {
  getSignedUrl,
} from "npm:@aws-sdk/s3-request-presigner"

/* ==========================================================================
   ENVIRONMENT
   ========================================================================== */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? ""

const SUPABASE_ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  ""

const R2_ACCOUNT_ID =
  Deno.env.get("R2_ACCOUNT_ID") ?? ""

const R2_ACCESS_KEY_ID =
  Deno.env.get("R2_ACCESS_KEY_ID") ?? ""

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
  Deno.env.get(
    "R2_ENDPOINT",
  ) ||
  (
    R2_ACCOUNT_ID
      ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : ""
  )

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const MAX_FILE_SIZE =
  50 * 1024 * 1024

const PRESIGNED_URL_EXPIRY =
  15 * 60

/* ==========================================================================
   ALLOWED FILE TYPES
   ========================================================================== */

const allowedMimeTypes =
  new Set([
    "application/pdf",

    "application/msword",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    "application/vnd.ms-excel",

    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    "application/vnd.ms-powerpoint",

    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    "text/plain",

    "text/csv",

    "image/jpeg",

    "image/png",

    "image/webp",

    "image/gif",

    "application/zip",

    "application/x-zip-compressed",
  ])

/* ==========================================================================
   ALLOWED RELATED TYPES
   ========================================================================== */

const allowedRelatedTypes =
  new Set([
    "client",
    "project",
    "invoice",
    "expense",
    "employee",
    "company",
  ])

/* ==========================================================================
   CORS
   ========================================================================== */

/*
 * Production domains:
 *
 * https://xyphoraprimemanagement.com
 * https://www.xyphoraprimemanagement.com
 *
 * Local development:
 *
 * http://localhost:5173
 * https://localhost:5173
 * http://localhost:8443
 * https://localhost:8443
 *
 * Additional origins can be added through:
 *
 * CORS_ORIGINS
 *
 * Example:
 *
 * CORS_ORIGINS=https://example-one.com,https://example-two.com
 */

const configuredOrigins = (
  Deno.env.get(
    "CORS_ORIGINS",
  ) ?? ""
)
  .split(",")
  .map(
    (origin) =>
      origin.trim(),
  )
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

/* ==========================================================================
   CORS HEADERS
   ========================================================================== */

function getCorsHeaders(
  request: Request,
): HeadersInit {
  const origin =
    request.headers.get(
      "Origin",
    )

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
   * Only allow explicitly configured origins.
   */
  if (
    origin &&
    allowedOrigins.has(
      origin,
    )
  ) {
    headers[
      "Access-Control-Allow-Origin"
    ] = origin
  }

  return headers
}

/* ==========================================================================
   RESPONSE HELPER
   ========================================================================== */

function jsonResponse(
  request: Request,
  body: Record<
    string,
    unknown
  >,
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
      },
    },
  )
}

/* ==========================================================================
   REQUIRED ENVIRONMENT
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

/* ==========================================================================
   ENVIRONMENT VALIDATION
   ========================================================================== */

function validateEnvironment() {
  const missing: string[] =
    []

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

  if (!R2_SECRET_ACCESS_KEY) {
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
      `Missing required environment variables: ${missing.join(
        ", ",
      )}`,
    )
  }
}

/* ==========================================================================
   R2 CLIENT
   ========================================================================== */

function createR2Client() {
  return new S3Client({
    region: "auto",

    endpoint:
      R2_ENDPOINT,

    credentials: {
      accessKeyId:
        R2_ACCESS_KEY_ID,

      secretAccessKey:
        R2_SECRET_ACCESS_KEY,
    },
  })
}

/* ==========================================================================
   SUPABASE USER CLIENT
   ========================================================================== */

function createUserSupabaseClient(
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

/* ==========================================================================
   AUTHENTICATE USER
   ========================================================================== */

async function authenticateUser(
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
      "Authentication required",
    )
  }

  const supabase =
    createUserSupabaseClient(
      request,
    )

  const {
    data: {
      user,
    },
    error:
      userError,
  } =
    await supabase.auth.getUser()

  if (
    userError ||
    !user
  ) {
    console.error(
      "Authentication error:",
      userError,
    )

    throw new Error(
      "Invalid or expired authentication session",
    )
  }

  return {
    user,
    supabase,
  }
}

/* ==========================================================================
   SANITIZE FILE NAME
   ========================================================================== */

function sanitizeFileName(
  fileName: string,
): string {
  const extensionIndex =
    fileName.lastIndexOf(
      ".",
    )

  const extension =
    extensionIndex >= 0
      ? fileName
          .slice(
            extensionIndex,
          )
          .toLowerCase()
          .replace(
            /[^a-z0-9.]/g,
            "",
          )
      : ""

  const baseName =
    extensionIndex >= 0
      ? fileName.slice(
          0,
          extensionIndex,
        )
      : fileName

  const sanitizedBase =
    baseName
      .normalize("NFKD")
      .replace(
        /[^\w\s-]/g,
        "",
      )
      .trim()
      .replace(
        /\s+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .slice(
        0,
        100,
      )

  return `${
    sanitizedBase ||
    "document"
  }${extension}`
}

/* ==========================================================================
   VALIDATE RELATED TYPE
   ========================================================================== */

function normalizeRelatedType(
  value: unknown,
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null
  }

  const normalized =
    value.trim().toLowerCase()

  if (
    !normalized
  ) {
    return null
  }

  if (
    !allowedRelatedTypes.has(
      normalized,
    )
  ) {
    return null
  }

  return normalized
}

/* ==========================================================================
   VALIDATE RELATED ID
   ========================================================================== */

function normalizeRelatedId(
  value: unknown,
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null
  }

  const normalized =
    value.trim()

  return normalized ||
    null
}

/* ==========================================================================
   MAIN EDGE FUNCTION
   ========================================================================== */

Deno.serve(
  async (
    request: Request,
  ) => {
    /* ======================================================================
       CORS PREFLIGHT

       IMPORTANT:
       OPTIONS must be answered before authentication.

       The browser sends this automatically before the authenticated POST.
       ====================================================================== */

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

    /* ======================================================================
       METHOD
       ====================================================================== */

    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        request,
        {
          success: false,
          error:
            "Method not allowed",
        },
        405,
      )
    }

    try {
      /* ====================================================================
         ENVIRONMENT
         ==================================================================== */

      validateEnvironment()

      /* ====================================================================
         AUTHENTICATION
         ==================================================================== */

      const {
        user,
      } =
        await authenticateUser(
          request,
        )

      /* ====================================================================
         READ REQUEST BODY
         ==================================================================== */

      let body: Record<
        string,
        unknown
      >

      try {
        body =
          await request.json()
      } catch {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Invalid JSON request body",
          },
          400,
        )
      }

      /* ====================================================================
         FILE NAME
         ==================================================================== */

      const fileName =
        typeof body.file_name ===
        "string"
          ? body.file_name.trim()
          : ""

      if (!fileName) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "File name is required",
          },
          400,
        )
      }

      /* ====================================================================
         FILE TYPE
         ==================================================================== */

      const fileType =
        typeof body.file_type ===
        "string"
          ? body.file_type
              .trim()
              .toLowerCase()
          : ""

      if (!fileType) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "File type is required",
          },
          400,
        )
      }

      /* ====================================================================
         FILE TYPE VALIDATION
         ==================================================================== */

      if (
        !allowedMimeTypes.has(
          fileType,
        )
      ) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "This file type is not supported",
          },
          400,
        )
      }

      /* ====================================================================
         FILE SIZE
         ==================================================================== */

      const fileSize =
        Number(
          body.file_size,
        )

      if (
        !Number.isFinite(
          fileSize,
        ) ||
        fileSize <= 0
      ) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "A valid file size is required",
          },
          400,
        )
      }

      /* ====================================================================
         MAX FILE SIZE
         ==================================================================== */

      if (
        fileSize >
        MAX_FILE_SIZE
      ) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "File size cannot exceed 50 MB",
          },
          413,
        )
      }

      /* ====================================================================
         RELATED TYPE
         ==================================================================== */

      const relatedType =
        normalizeRelatedType(
          body.related_type,
        )

      /*
       * If a related type was provided, it must be valid.
       */
      if (
        body.related_type !==
          undefined &&
        body.related_type !==
          null &&
        String(
          body.related_type,
        ).trim() !==
          "" &&
        !relatedType
      ) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Invalid related_type",
          },
          400,
        )
      }

      /* ====================================================================
         RELATED ID
         ==================================================================== */

      const relatedId =
        normalizeRelatedId(
          body.related_id,
        )

      /* ====================================================================
         SAFE FILE NAME
         ==================================================================== */

      const safeFileName =
        sanitizeFileName(
          fileName,
        )

      /* ====================================================================
         UNIQUE FILE ID
         ==================================================================== */

      const fileId =
        crypto.randomUUID()

      /* ====================================================================
         STORAGE PATH
         ==================================================================== */

      /*
       * IMPORTANT:
       *
       * This path matches document-download and document-delete:
       *
       * documents/{user.id}/{fileId}-{fileName}
       *
       * Therefore:
       *
       * document-upload
       * document-download
       * document-delete
       *
       * all use the same private storage namespace.
       */

      const storagePath = [
        "documents",
        user.id,
        `${fileId}-${safeFileName}`,
      ].join("/")

      /* ====================================================================
         R2 CLIENT
         ==================================================================== */

      const r2Client =
        createR2Client()

      /* ====================================================================
         PRESIGNED PUT COMMAND
         ==================================================================== */

      const command =
        new PutObjectCommand(
          {
            Bucket:
              R2_BUCKET_NAME,

            Key:
              storagePath,

            ContentType:
              fileType,

            ContentLength:
              fileSize,

            Metadata: {
              "uploaded-by":
                user.id,

              "file-id":
                fileId,

              "original-file-name":
                safeFileName,

              ...(relatedType
                ? {
                    "related-type":
                      relatedType,
                  }
                : {}),

              ...(relatedId
                ? {
                    "related-id":
                      relatedId,
                  }
                : {}),
            },
          },
        )

      /* ====================================================================
         GENERATE PRESIGNED UPLOAD URL
         ==================================================================== */

      let uploadUrl: string

      try {
        uploadUrl =
          await getSignedUrl(
            r2Client,
            command,
            {
              expiresIn:
                PRESIGNED_URL_EXPIRY,
            },
          )
      } catch (
        signingError
      ) {
        console.error(
          "R2 signed upload URL error:",
          signingError,
        )

        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Unable to create secure upload URL",
          },
          500,
        )
      }

      /* ====================================================================
         SUCCESS
         ==================================================================== */

      return jsonResponse(
        request,
        {
          success: true,

          upload_url:
            uploadUrl,

          storage_path:
            storagePath,

          file_id:
            fileId,

          uploaded_by:
            user.id,

          related_type:
            relatedType,

          related_id:
            relatedId,

          file_name:
            safeFileName,

          file_type:
            fileType,

          file_size:
            fileSize,

          expires_in:
            PRESIGNED_URL_EXPIRY,
        },
        200,
      )
    } catch (error) {
      /* ====================================================================
         GLOBAL ERROR
         ==================================================================== */

      console.error(
        "document-upload error:",
        error,
      )

      const message =
        error instanceof Error
          ? error.message
          : "Unable to create upload URL"

      let status = 500

      if (
        message.includes(
          "Authentication required",
        ) ||
        message.includes(
          "Invalid or expired authentication",
        )
      ) {
        status = 401
      }

      return jsonResponse(
        request,
        {
          success: false,
          error:
            message,
        },
        status,
      )
    }
  },
)