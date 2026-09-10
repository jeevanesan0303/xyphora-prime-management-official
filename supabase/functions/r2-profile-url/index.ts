import { createClient } from 'npm:@supabase/supabase-js@2'
import { GetObjectCommand, S3Client } from 'npm:@aws-sdk/client-s3'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner'

/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const SIGNED_URL_EXPIRES_IN = 60 * 60 // 1 hour

/*
 * =========================================================
 * CORS
 * =========================================================
 *
 * Your current development URL is:
 *
 * http://localhost:8443
 *
 * We also allow https://localhost:8443 because your
 * previous development session used HTTPS.
 *
 * For production, set:
 *
 * CORS_ORIGINS=https://your-domain.com
 *
 * in Supabase Edge Function secrets.
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8443',
  'https://localhost:8443',
  'http://localhost:5173',
  'https://localhost:5173',
]

const configuredOrigins =
  Deno.env
    .get('CORS_ORIGINS')
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []

const allowedOrigins = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...configuredOrigins,
])

function getCorsHeaders(
  request: Request,
): Record<string, string> {
  const origin =
    request.headers.get('origin') ?? ''

  /*
   * If the browser origin is configured, return that
   * exact origin.
   */
  if (allowedOrigins.has(origin)) {
    return {
      'Access-Control-Allow-Origin':
        origin,
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods':
        'POST, OPTIONS',
      'Access-Control-Max-Age':
        '86400',
      Vary: 'Origin',
    }
  }

  /*
   * For non-browser/server requests where there is no
   * Origin header, CORS is not required.
   *
   * For an unknown browser origin, do not grant access.
   */
  return {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':
      'POST, OPTIONS',
    'Access-Control-Max-Age':
      '86400',
    Vary: 'Origin',
  }
}

/*
 * =========================================================
 * RESPONSE HELPERS
 * =========================================================
 */

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
        'Content-Type':
          'application/json',
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

/*
 * =========================================================
 * ENVIRONMENT HELPERS
 * =========================================================
 */

function getRequiredEnv(
  name: string,
): string {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(
      `${name} is not configured`,
    )
  }

  return value
}

/*
 * =========================================================
 * R2 CLIENT
 * =========================================================
 */

function createR2Client(): S3Client {
  const accountId =
    getRequiredEnv(
      'R2_ACCOUNT_ID',
    )

  const accessKeyId =
    getRequiredEnv(
      'R2_ACCESS_KEY_ID',
    )

  const secretAccessKey =
    getRequiredEnv(
      'R2_SECRET_ACCESS_KEY',
    )

  return new S3Client({
    region: 'auto',
    endpoint:
      `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

/*
 * =========================================================
 * PROFILE OBJECT SECURITY
 * =========================================================
 *
 * avatar_url should contain an R2 object key such as:
 *
 * profiles/<USER_ID>/avatar-<UUID>.webp
 *
 * We NEVER allow a user to request an arbitrary R2 object.
 */

function isOwnedProfileObject(
  key: string,
  userId: string,
): boolean {
  return key.startsWith(
    `profiles/${userId}/avatar-`,
  )
}

/*
 * =========================================================
 * EXTRACT REQUESTED ACTION
 * =========================================================
 *
 * The frontend can simply call this function to obtain
 * the current avatar URL.
 *
 * Optional action:
 *
 * action = "get"
 *
 * If omitted, "get" is assumed.
 */

async function readRequestData(
  request: Request,
): Promise<Record<string, unknown>> {
  const contentType =
    request.headers.get(
      'content-type',
    ) ?? ''

  /*
   * JSON request.
   */
  if (
    contentType
      .toLowerCase()
      .includes(
        'application/json',
      )
  ) {
    try {
      const body =
        await request.json()

      if (
        body &&
        typeof body === 'object'
      ) {
        return body as Record<
          string,
          unknown
        >
      }

      return {}
    } catch {
      return {}
    }
  }

  /*
   * FormData request.
   *
   * This also makes the function compatible with a frontend
   * implementation that sends FormData.
   */
  if (
    contentType
      .toLowerCase()
      .includes(
        'multipart/form-data',
      )
  ) {
    const formData =
      await request.formData()

    const result: Record<
      string,
      unknown
    > = {}

    for (
      const [
        key,
        value,
      ] of formData.entries()
    ) {
      if (
        typeof value ===
        'string'
      ) {
        result[key] = value
      }
    }

    return result
  }

  return {}
}

/*
 * =========================================================
 * MAIN FUNCTION
 * =========================================================
 */

Deno.serve(
  async (request: Request) => {
    /*
     * =====================================================
     * CORS PREFLIGHT
     * =====================================================
     *
     * IMPORTANT:
     *
     * OPTIONS must be handled BEFORE checking the JWT.
     *
     * This is what prevents:
     *
     * OPTIONS → 401 → CORS ERROR
     *
     * in the browser.
     */

    if (
      request.method ===
      'OPTIONS'
    ) {
      const corsHeaders =
        getCorsHeaders(request)

      /*
       * If an Origin header exists but it is not allowed,
       * reject it.
       */
      const origin =
        request.headers.get(
          'origin',
        )

      if (
        origin &&
        !allowedOrigins.has(
          origin,
        )
      ) {
        return new Response(
          'Origin not allowed',
          {
            status: 403,
            headers:
              corsHeaders,
          },
        )
      }

      return new Response(
        'ok',
        {
          status: 200,
          headers:
            corsHeaders,
        },
      )
    }

    /*
     * =====================================================
     * METHOD
     * =====================================================
     */

    if (
      request.method !==
      'POST'
    ) {
      return errorResponse(
        request,
        'Method not allowed.',
        405,
      )
    }

    /*
     * =====================================================
     * ORIGIN CHECK
     * =====================================================
     */

    const origin =
      request.headers.get(
        'origin',
      )

    if (
      origin &&
      !allowedOrigins.has(
        origin,
      )
    ) {
      return errorResponse(
        request,
        'Origin not allowed.',
        403,
      )
    }

    try {
      /*
       * ===================================================
       * AUTHORIZATION
       * ===================================================
       */

      const authorization =
        request.headers.get(
          'Authorization',
        )

      if (!authorization) {
        return errorResponse(
          request,
          'Missing authorization header.',
          401,
        )
      }

      if (
        !authorization
          .toLowerCase()
          .startsWith(
            'bearer ',
          )
      ) {
        return errorResponse(
          request,
          'Invalid authorization header.',
          401,
        )
      }

      /*
       * ===================================================
       * SUPABASE USER CLIENT
       * ===================================================
       */

      const supabaseUrl =
        getRequiredEnv(
          'SUPABASE_URL',
        )

      const supabaseAnonKey =
        getRequiredEnv(
          'SUPABASE_ANON_KEY',
        )

      const supabaseUser =
        createClient(
          supabaseUrl,
          supabaseAnonKey,
          {
            global: {
              headers: {
                Authorization:
                  authorization,
              },
            },
          },
        )

      /*
       * Verify authenticated user.
       */

      const {
        data: {
          user,
        },
        error: authError,
      } =
        await supabaseUser.auth.getUser()

      if (
        authError ||
        !user
      ) {
        console.error(
          'Profile URL authentication failed:',
          authError,
        )

        return errorResponse(
          request,
          'Unauthorized. Please sign in again.',
          401,
        )
      }

      /*
       * ===================================================
       * SUPABASE SERVICE CLIENT
       * ===================================================
       */

      const serviceRoleKey =
        getRequiredEnv(
          'SUPABASE_SERVICE_ROLE_KEY',
        )

      const supabaseAdmin =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken:
                false,
              persistSession:
                false,
            },
          },
        )

      /*
       * ===================================================
       * LOAD USER PROFILE
       * ===================================================
       */

      const {
        data: profile,
        error: profileError,
      } =
        await supabaseAdmin
          .from('profiles')
          .select(
            'id, avatar_url',
          )
          .eq(
            'id',
            user.id,
          )
          .maybeSingle()

      if (profileError) {
        console.error(
          'Failed to load profile:',
          profileError,
        )

        return errorResponse(
          request,
          'Unable to load your profile.',
          500,
        )
      }

      if (!profile) {
        return errorResponse(
          request,
          'Profile not found.',
          404,
        )
      }

      /*
       * ===================================================
       * REQUEST DATA
       * ===================================================
       */

      const requestData =
        await readRequestData(
          request,
        )

      const requestedAction =
        typeof requestData.action ===
        'string'
          ? requestData.action
              .trim()
              .toLowerCase()
          : 'get'

      /*
       * Only "get" is supported by this function.
       */
      if (
        requestedAction !==
          'get' &&
        requestedAction !==
          'url' &&
        requestedAction !==
          'signed-url'
      ) {
        return errorResponse(
          request,
          'Invalid profile URL action.',
          400,
        )
      }

      /*
       * ===================================================
       * NO AVATAR
       * ===================================================
       */

      const avatarKey =
        typeof profile.avatar_url ===
        'string'
          ? profile.avatar_url.trim()
          : ''

      if (!avatarKey) {
        return jsonResponse(
          request,
          {
            success: true,
            avatar_url: null,
            url: null,
            signed_url: null,
            expires_in:
              SIGNED_URL_EXPIRES_IN,
          },
        )
      }

      /*
       * ===================================================
       * SECURITY CHECK
       * ===================================================
       *
       * Never allow the authenticated user to use this
       * endpoint to sign an arbitrary R2 object.
       */

      if (
        !isOwnedProfileObject(
          avatarKey,
          user.id,
        )
      ) {
        console.error(
          'Invalid avatar ownership:',
          {
            userId: user.id,
            avatarKey,
          },
        )

        return errorResponse(
          request,
          'Invalid profile image reference.',
          403,
        )
      }

      /*
       * ===================================================
       * R2 CONFIGURATION
       * ===================================================
       */

      const bucket =
        getRequiredEnv(
          'R2_BUCKET_NAME',
        )

      const r2 =
        createR2Client()

      /*
       * ===================================================
       * GENERATE SIGNED URL
       * ===================================================
       */

      const command =
        new GetObjectCommand({
          Bucket: bucket,
          Key: avatarKey,
          ResponseContentType:
            'image/*',
          ResponseCacheControl:
            'private, max-age=3600',
        })

      const signedUrl =
        await getSignedUrl(
          r2,
          command,
          {
            expiresIn:
              SIGNED_URL_EXPIRES_IN,
          },
        )

      /*
       * ===================================================
       * SUCCESS
       * ===================================================
       *
       * We return multiple compatible field names:
       *
       * url
       * signed_url
       * avatar_url
       *
       * The stored avatar_url remains the private R2 key.
       */

      return jsonResponse(
        request,
        {
          success: true,

          /*
           * Private R2 object key.
           */
          avatar_url:
            avatarKey,

          /*
           * Signed URL used by the browser to display
           * the image.
           */
          url: signedUrl,
          signed_url:
            signedUrl,

          /*
           * Signed URL expiration.
           */
          expires_in:
            SIGNED_URL_EXPIRES_IN,
        },
      )
    } catch (error) {
      /*
       * ===================================================
       * GLOBAL ERROR HANDLER
       * ===================================================
       */

      console.error(
        'r2-profile-url error:',
        error,
      )

      return errorResponse(
        request,
        error instanceof Error
          ? error.message
          : 'Failed to generate profile image URL.',
        500,
      )
    }
  },
)