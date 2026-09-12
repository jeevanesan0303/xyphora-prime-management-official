import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "npm:@supabase/supabase-js@2"

import {
  DeleteObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3"

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
  Deno.env.get("R2_BUCKET_NAME") ??
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

/*
 * Production:
 *
 * https://xyphoraprimemanagement.com
 *
 * Also allow the www version because it is a separate browser origin.
 *
 * CORS_ORIGINS can additionally contain comma-separated origins.
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

/* --------------------------------------------------------------------------
   CORS headers
   -------------------------------------------------------------------------- */

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
   * Only return Access-Control-Allow-Origin
   * for an explicitly allowed origin.
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

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(
        ", ",
      )}`,
    )
  }
}

/* ==========================================================================
   SUPABASE CLIENT
   ========================================================================== */

/**
 * Creates a Supabase client using the currently authenticated
 * user's access token.
 *
 * This keeps the document lookup and delete subject to the
 * authenticated user's Supabase RLS policies.
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
   AUTHENTICATION
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
    error: userError,
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
   MAIN
   ========================================================================== */

Deno.serve(
  async (
    request: Request,
  ) => {
    /* ======================================================================
       CORS PREFLIGHT

       IMPORTANT:
       This must happen BEFORE authentication.

       The browser sends OPTIONS before POST when using the Authorization
       header and other non-simple headers.
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
         AUTHENTICATE
         ==================================================================== */

      const {
        user,
        supabase,
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
         DOCUMENT ID
         ==================================================================== */

      const documentId =
        typeof body.document_id ===
        "string"
          ? body.document_id.trim()
          : ""

      if (!documentId) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Document ID is required",
          },
          400,
        )
      }

      /* ====================================================================
         LOAD DOCUMENT
         ==================================================================== */

      const {
        data: document,
        error:
          documentError,
      } =
        await supabase
          .from("documents")
          .select(
            "id, storage_path",
          )
          .eq(
            "id",
            documentId,
          )
          .maybeSingle()

      if (documentError) {
        console.error(
          "Document lookup error:",
          documentError,
        )

        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Unable to retrieve document",
          },
          500,
        )
      }

      /* ====================================================================
         DOCUMENT NOT FOUND
         ==================================================================== */

      if (!document) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Document not found",
          },
          404,
        )
      }

      /* ====================================================================
         STORAGE PATH VALIDATION
         ==================================================================== */

      const storagePath =
        typeof document.storage_path ===
        "string"
          ? document.storage_path.trim()
          : ""

      if (!storagePath) {
        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Document storage path is missing",
          },
          400,
        )
      }

      /* ====================================================================
         OWNERSHIP / SECURITY CHECK
         ==================================================================== */

      /*
       * Existing document storage convention:
       *
       * documents/{user.id}/...
       *
       * Only allow the authenticated user to delete objects under
       * their own document directory.
       */

      const expectedPrefix =
        `documents/${user.id}/`

      if (
        !storagePath.startsWith(
          expectedPrefix,
        )
      ) {
        console.warn(
          "Unauthorized document deletion attempt:",
          {
            userId:
              user.id,
            documentId,
            storagePath,
          },
        )

        return jsonResponse(
          request,
          {
            success: false,
            error:
              "You do not have permission to delete this document",
          },
          403,
        )
      }

      /* ====================================================================
         R2 CLIENT
         ==================================================================== */

      const r2Client =
        createR2Client()

      /* ====================================================================
         DELETE FROM R2
         ==================================================================== */

      try {
        await r2Client.send(
          new DeleteObjectCommand(
            {
              Bucket:
                R2_BUCKET_NAME,

              Key:
                storagePath,
            },
          ),
        )
      } catch (
        r2Error
      ) {
        console.error(
          "R2 document deletion error:",
          r2Error,
        )

        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Unable to delete the document from storage",
          },
          500,
        )
      }

      /* ====================================================================
         DELETE DATABASE RECORD
         ==================================================================== */

      const {
        error:
          deleteError,
      } =
        await supabase
          .from("documents")
          .delete()
          .eq(
            "id",
            documentId,
          )

      if (deleteError) {
        console.error(
          "Database document deletion error:",
          deleteError,
        )

        /*
         * R2 object has already been deleted.
         *
         * We cannot restore it automatically here.
         *
         * Return a clear message so the caller knows that storage and
         * database are temporarily inconsistent.
         */
        return jsonResponse(
          request,
          {
            success: false,

            error:
              "The R2 file was deleted, but the database record could not be removed",

            details:
              deleteError.message,

            document_id:
              documentId,
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

          document_id:
            documentId,

          message:
            "Document deleted successfully",
        },
        200,
      )
    } catch (error) {
      /* ====================================================================
         GLOBAL ERROR
         ==================================================================== */

      console.error(
        "document-delete error:",
        error,
      )

      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete document"

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