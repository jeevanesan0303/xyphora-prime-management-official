import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "npm:@supabase/supabase-js@2"

import {
  GetObjectCommand,
  S3Client,
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
   DOWNLOAD URL EXPIRY
   ========================================================================== */

/*
 * Signed download URLs remain valid for 15 minutes.
 *
 * The R2 bucket stays private.
 */
const DOWNLOAD_URL_EXPIRY =
  15 * 60

/* ==========================================================================
   CORS
   ========================================================================== */

/*
 * Production domains.
 *
 * IMPORTANT:
 *
 * These are different browser origins:
 *
 * https://xyphoraprimemanagement.com
 *
 * https://www.xyphoraprimemanagement.com
 *
 * Both are therefore explicitly allowed.
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
   Generate CORS headers
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
   SUPABASE CLIENT
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
   DOCUMENT STORAGE PATH VALIDATION
   ========================================================================== */

/**
 * Ensures the document belongs to the currently
 * authenticated user's private document namespace.
 *
 * Expected:
 *
 * documents/{user.id}/...
 */
function hasDocumentAccess(
  storagePath: string,
  userId: string,
): boolean {
  const expectedPrefix =
    `documents/${userId}/`

  return storagePath.startsWith(
    expectedPrefix,
  )
}

/* ==========================================================================
   SAFE CONTENT DISPOSITION
   ========================================================================== */

/**
 * Creates a safe attachment filename.
 *
 * Removes quotes, CR/LF characters and other characters
 * that could interfere with the Content-Disposition header.
 */
function sanitizeFileName(
  fileName: string,
): string {
  const cleaned =
    fileName
      .replace(
        /[\r\n"]/g,
        "",
      )
      .replace(
        /\\/g,
        "",
      )
      .trim()

  return cleaned ||
    "download"
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

       OPTIONS must be handled BEFORE authentication.

       The browser sends this request automatically before the actual
       authenticated POST request.
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
         REQUEST BODY
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
            [
              "id",
              "file_name",
              "file_type",
              "storage_path",
              "related_type",
              "related_id",
            ].join(", "),
          )
          .eq(
            "id",
            documentId,
          )
          .maybeSingle()

      /* ====================================================================
         DATABASE ERROR
         ==================================================================== */

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
         VALIDATE STORAGE PATH
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
         SECURITY CHECK
         ==================================================================== */

      /*
       * Only allow access to files inside:
       *
       * documents/{authenticated-user-id}/
       *
       * This prevents one authenticated user from requesting another
       * user's private R2 object.
       */

      if (
        !hasDocumentAccess(
          storagePath,
          user.id,
        )
      ) {
        console.warn(
          "Unauthorized document download attempt:",
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
              "You do not have access to this document",
          },
          403,
        )
      }

      /* ====================================================================
         FILE NAME
         ==================================================================== */

      const fileName =
        sanitizeFileName(
          typeof document.file_name ===
            "string"
            ? document.file_name
            : "download",
        )

      /* ====================================================================
         FILE TYPE
         ==================================================================== */

      const fileType =
        typeof document.file_type ===
        "string" &&
        document.file_type.trim()
          ? document.file_type.trim()
          : "application/octet-stream"

      /* ====================================================================
         R2 CLIENT
         ==================================================================== */

      const r2Client =
        createR2Client()

      /* ====================================================================
         SIGNED DOWNLOAD COMMAND
         ==================================================================== */

      const command =
        new GetObjectCommand(
          {
            Bucket:
              R2_BUCKET_NAME,

            Key:
              storagePath,

            /*
             * Tell the browser what type of file it is.
             */
            ResponseContentType:
              fileType,

            /*
             * Force download and preserve the original filename.
             */
            ResponseContentDisposition:
              `attachment; filename="${fileName}"`,
          },
        )

      /* ====================================================================
         GENERATE SIGNED URL
         ==================================================================== */

      let downloadUrl: string

      try {
        downloadUrl =
          await getSignedUrl(
            r2Client,
            command,
            {
              expiresIn:
                DOWNLOAD_URL_EXPIRY,
            },
          )
      } catch (
        signingError
      ) {
        console.error(
          "R2 signed URL generation error:",
          signingError,
        )

        return jsonResponse(
          request,
          {
            success: false,
            error:
              "Unable to create secure download URL",
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

          download_url:
            downloadUrl,

          file_name:
            document.file_name,

          file_type:
            document.file_type,

          document_id:
            document.id,

          related_type:
            document.related_type,

          related_id:
            document.related_id,

          expires_in:
            DOWNLOAD_URL_EXPIRY,
        },
        200,
      )
    } catch (error) {
      /* ====================================================================
         GLOBAL ERROR
         ==================================================================== */

      console.error(
        "document-download error:",
        error,
      )

      const message =
        error instanceof Error
          ? error.message
          : "Unable to create download URL"

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