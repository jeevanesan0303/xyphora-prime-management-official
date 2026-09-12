import "jsr:@supabase/functions-js/edge-runtime.d.ts"

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

const MAX_FILE_SIZE =
  50 * 1024 * 1024

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
 * Production:
 *
 * https://xyphoraprimemanagement.com
 * https://www.xyphoraprimemanagement.com
 *
 * Development:
 *
 * http://localhost:5173
 * https://localhost:5173
 * http://localhost:8443
 * https://localhost:8443
 *
 * Additional origins may be supplied through:
 *
 * CORS_ORIGINS
 *
 * Example:
 *
 * CORS_ORIGINS=https://example.com,https://another.com
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
   * Only return the requesting origin when
   * it is explicitly allowed.
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
   SUPABASE USER CLIENT
   ========================================================================== */

/**
 * Creates a Supabase client using the authenticated
 * user's Authorization header.
 */
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
   STORAGE PATH VALIDATION
   ========================================================================== */

/**
 * Validates the private document storage namespace.
 *
 * Expected format:
 *
 * documents/{user.id}/{uuid}-{filename}
 *
 * Example:
 *
 * documents/
 *   1702f304-f289-479d-9b17-48b0a67e6148/
 *   7f9f...-contract.pdf
 */
function validateStoragePath(
  storagePath: string,
  userId: string,
): boolean {
  const expectedPrefix =
    `documents/${userId}/`

  if (
    !storagePath.startsWith(
      expectedPrefix,
    )
  ) {
    return false
  }

  /*
   * Get the part after:
   *
   * documents/{user.id}/
   */
  const relativePath =
    storagePath.slice(
      expectedPrefix.length,
    )

  /*
   * Must contain a filename.
   */
  if (!relativePath) {
    return false
  }

  /*
   * Prevent path traversal.
   */
  if (
    relativePath.includes(
      "..",
    ) ||
    relativePath.includes(
      "\\",
    )
  ) {
    return false
  }

  /*
   * Documents generated by document-upload use:
   *
   * UUID-filename
   *
   * Therefore require the first section to look like a UUID.
   */
  const uuidPrefix =
    relativePath.split(
      "-",
      5,
    ).join("-")

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-/i

  return uuidPattern.test(
    relativePath,
  )
}

/* ==========================================================================
   NORMALIZE RELATED TYPE
   ========================================================================== */

function normalizeRelatedType(
  value: unknown,
): string {
  if (
    typeof value !==
    "string"
  ) {
    return ""
  }

  return value
    .trim()
    .toLowerCase()
}

/* ==========================================================================
   NORMALIZE RELATED ID
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
   NORMALIZE NOTES
   ========================================================================== */

function normalizeNotes(
  value: unknown,
): string {
  if (
    typeof value !==
    "string"
  ) {
    return ""
  }

  return value.trim()
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
       OPTIONS must be handled before authentication.
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
        supabase,
      } =
        await authenticateUser(
          request,
        )

      /* ====================================================================
         READ JSON BODY
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
         STORAGE PATH
         ==================================================================== */

      const storagePath =
        typeof body.storage_path ===
        "string"
          ? body.storage_path.trim()
          : ""

      if (!storagePath) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Storage path is required",
          },
          400,
        )
      }

      /* ====================================================================
         STORAGE PATH SECURITY
         ==================================================================== */

      if (
        !validateStoragePath(
          storagePath,
          user.id,
        )
      ) {
        console.warn(
          "Invalid document storage path:",
          {
            userId:
              user.id,

            storagePath,
          },
        )

        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Invalid storage path",
          },
          403,
        )
      }

      /* ====================================================================
         RELATED TYPE
         ==================================================================== */

      const relatedType =
        normalizeRelatedType(
          body.related_type,
        )

      if (
        !allowedRelatedTypes.has(
          relatedType,
        )
      ) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Invalid related document type",
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
         NOTES
         ==================================================================== */

      const notes =
        normalizeNotes(
          body.notes,
        )

      /* ====================================================================
         PREVENT DUPLICATE STORAGE PATH
         ==================================================================== */

      const {
        data:
          existingDocument,
        error:
          existingDocumentError,
      } =
        await supabase
          .from("documents")
          .select("id")
          .eq(
            "storage_path",
            storagePath,
          )
          .maybeSingle()

      if (
        existingDocumentError
      ) {
        console.error(
          "Existing document lookup error:",
          existingDocumentError,
        )

        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Unable to verify document storage path",
          },
          500,
        )
      }

      if (
        existingDocument
      ) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "A document with this storage path already exists",
          },
          409,
        )
      }

      /* ====================================================================
         INSERT DOCUMENT METADATA
         ==================================================================== */

      const {
        data:
          document,
        error:
          insertError,
      } =
        await supabase
          .from("documents")
          .insert({
            file_name:
              fileName,

            file_type:
              fileType,

            file_size:
              fileSize,

            storage_path:
              storagePath,

            related_type:
              relatedType,

            related_id:
              relatedId,

            upload_date:
              new Date().toISOString(),

            notes,
          })
          .select()
          .single()

      /* ====================================================================
         INSERT ERROR
         ==================================================================== */

      if (
        insertError
      ) {
        console.error(
          "Document insert error:",
          insertError,
        )

        return jsonResponse(
          request,
          {
            success: false,

            error:
              "Unable to save document metadata",

            details:
              insertError.message,
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

          document,
        },
        200,
      )
    } catch (error) {
      /* ====================================================================
         GLOBAL ERROR
         ==================================================================== */

      console.error(
        "document-upload-complete error:",
        error,
      )

      const message =
        error instanceof Error
          ? error.message
          : "Unable to complete document upload"

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