import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from 'npm:@aws-sdk/client-s3'

/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const ALLOWED_EXTENSIONS: Record<
  string,
  string
> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/*
 * Current development origin from your screenshot:
 *
 * https://localhost:8443
 *
 * Additional common development origin is included.
 *
 * For production, add your actual deployed frontend
 * origin to CORS_ORIGINS in Supabase secrets.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://localhost:8443',
  'http://localhost:8443',
  'http://localhost:5173',
  'https://localhost:5173',
]

const configuredOrigins =
  Deno.env.get('CORS_ORIGINS')
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []

const allowedOrigins = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...configuredOrigins,
])

/*
 * =========================================================
 * CORS
 * =========================================================
 */

function getCorsHeaders(
  request: Request,
): Record<string, string> {
  const origin =
    request.headers.get('origin') ?? ''

  const allowedOrigin =
    allowedOrigins.has(origin)
      ? origin
      : DEFAULT_ALLOWED_ORIGINS.includes(
            'https://localhost:8443',
          )
        ? 'https://localhost:8443'
        : origin

  return {
    'Access-Control-Allow-Origin':
      allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':
      'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
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
 * ENVIRONMENT
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

function createR2Client() {
  const accountId =
    getRequiredEnv('R2_ACCOUNT_ID')

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
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

/*
 * =========================================================
 * FILE NAME HELPERS
 * =========================================================
 */

function getExtension(
  mimeType: string,
): string {
  return (
    ALLOWED_EXTENSIONS[mimeType] ||
    'webp'
  )
}

/*
 * =========================================================
 * R2 KEY VALIDATION
 * =========================================================
 *
 * We only allow deletion of profile objects created
 * by this function.
 *
 * This prevents a malicious request from supplying an
 * arbitrary R2 key and deleting another application's file.
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
 * DELETE OLD PROFILE IMAGE
 * =========================================================
 */

async function deleteR2Object(
  r2: S3Client,
  bucket: string,
  key: string,
): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
}

/*
 * =========================================================
 * MAIN EDGE FUNCTION
 * =========================================================
 */

Deno.serve(
  async (request: Request) => {
    /*
     * -----------------------------------------------------
     * CORS PREFLIGHT
     * -----------------------------------------------------
     *
     * This is the important part for the 401/CORS error
     * shown in your browser console.
     *
     * OPTIONS must NOT require authentication.
     */

    if (request.method === 'OPTIONS') {
      return new Response('ok', {
        status: 200,
        headers:
          getCorsHeaders(request),
      })
    }

    /*
     * Only POST is supported.
     */

    if (request.method !== 'POST') {
      return errorResponse(
        request,
        'Method not allowed.',
        405,
      )
    }

    try {
      /*
       * ---------------------------------------------------
       * AUTHORIZATION
       * ---------------------------------------------------
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
          .startsWith('bearer ')
      ) {
        return errorResponse(
          request,
          'Invalid authorization header.',
          401,
        )
      }

      /*
       * ---------------------------------------------------
       * SUPABASE USER CLIENT
       * ---------------------------------------------------
       *
       * This client uses the caller's JWT so Supabase
       * knows which authenticated user is making the request.
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
          'Authentication failed:',
          authError,
        )

        return errorResponse(
          request,
          'Unauthorized. Please sign in again.',
          401,
        )
      }

      /*
       * ---------------------------------------------------
       * SERVICE ROLE CLIENT
       * ---------------------------------------------------
       *
       * Used only inside this trusted Edge Function for
       * updating the authenticated user's profile.
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
              persistSession: false,
            },
          },
        )

      /*
       * ---------------------------------------------------
       * VERIFY PROFILE
       * ---------------------------------------------------
       *
       * Make sure the authenticated user has a profile.
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
       * ---------------------------------------------------
       * R2 CONFIGURATION
       * ---------------------------------------------------
       */

      const bucket =
        getRequiredEnv(
          'R2_BUCKET_NAME',
        )

      const r2 =
        createR2Client()

      /*
       * ---------------------------------------------------
       * READ MULTIPART FORM
       * ---------------------------------------------------
       */

      const contentType =
        request.headers.get(
          'content-type',
        ) ?? ''

      if (
        !contentType
          .toLowerCase()
          .includes(
            'multipart/form-data',
          )
      ) {
        return errorResponse(
          request,
          'Request must use multipart/form-data.',
          400,
        )
      }

      const formData =
        await request.formData()

      /*
       * ---------------------------------------------------
       * ACTION
       * ---------------------------------------------------
       *
       * Supported:
       *
       * upload
       * delete
       *
       * Default = upload
       */

      const actionValue =
        formData.get('action')

      const action =
        typeof actionValue === 'string'
          ? actionValue
              .trim()
              .toLowerCase()
          : 'upload'

      /*
       * ===================================================
       * DELETE PROFILE AVATAR
       * ===================================================
       */

      if (action === 'delete') {
        const oldAvatarUrl =
          profile.avatar_url

        /*
         * Nothing to delete.
         */

        if (!oldAvatarUrl) {
          return jsonResponse(
            request,
            {
              success: true,
              message:
                'No profile image to remove.',
              avatar_url: null,
            },
          )
        }

        /*
         * The database stores the R2 object key.
         *
         * We intentionally only delete objects that belong
         * to this authenticated user's profile namespace.
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
          } catch (deleteError) {
            /*
             * Log the storage failure, but continue clearing
             * the database reference. This prevents a broken
             * old R2 object from leaving the user unable to
             * remove their profile image.
             */

            console.error(
              'Failed to delete old profile image from R2:',
              deleteError,
            )
          }
        }

        /*
         * Clear avatar_url.
         */

        const {
          error: updateError,
        } =
          await supabaseAdmin
            .from('profiles')
            .update({
              avatar_url: null,
            })
            .eq(
              'id',
              user.id,
            )

        if (updateError) {
          console.error(
            'Failed to clear avatar_url:',
            updateError,
          )

          return errorResponse(
            request,
            'Profile image was removed from storage, but the profile could not be updated.',
            500,
          )
        }

        return jsonResponse(
          request,
          {
            success: true,
            message:
              'Profile image removed successfully.',
            avatar_url: null,
          },
        )
      }

      /*
       * ===================================================
       * UPLOAD PROFILE AVATAR
       * ===================================================
       */

      if (action !== 'upload') {
        return errorResponse(
          request,
          'Invalid profile image action.',
          400,
        )
      }

      /*
       * ---------------------------------------------------
       * GET FILE
       * ---------------------------------------------------
       *
       * Accept common field names so this function works
       * with the current ProfilePage implementation even
       * if it uses "file", "avatar", or "image".
       */

      const possibleFileFields = [
        'file',
        'avatar',
        'image',
      ]

      let file:
        | File
        | null = null

      for (
        const fieldName of possibleFileFields
      ) {
        const candidate =
          formData.get(fieldName)

        if (
          candidate instanceof File
        ) {
          file = candidate
          break
        }
      }

      if (!file) {
        return errorResponse(
          request,
          'No profile image was provided.',
          400,
        )
      }

      /*
       * ---------------------------------------------------
       * FILE TYPE
       * ---------------------------------------------------
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
          'Invalid image type. Please upload JPG, PNG, WEBP, or GIF.',
          400,
        )
      }

      /*
       * ---------------------------------------------------
       * FILE SIZE
       * ---------------------------------------------------
       */

      if (
        file.size <= 0
      ) {
        return errorResponse(
          request,
          'The selected image is empty.',
          400,
        )
      }

      if (
        file.size >
        MAX_FILE_SIZE
      ) {
        return errorResponse(
          request,
          'Profile image must be 5 MB or smaller.',
          400,
        )
      }

      /*
       * ---------------------------------------------------
       * READ FILE
       * ---------------------------------------------------
       */

      const fileBuffer =
        await file.arrayBuffer()

      /*
       * ---------------------------------------------------
       * GENERATE PRIVATE R2 OBJECT KEY
       * ---------------------------------------------------
       *
       * Example:
       *
       * profiles/
       *   USER_UUID/
       *     avatar-UUID.webp
       *
       * The random UUID prevents filename collisions and
       * makes old/new avatar replacement safe.
       */

      const extension =
        getExtension(
          mimeType,
        )

      const objectKey =
        `profiles/${user.id}/avatar-${crypto.randomUUID()}.${extension}`

      /*
       * ---------------------------------------------------
       * UPLOAD TO R2
       * ---------------------------------------------------
       */

      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: new Uint8Array(
            fileBuffer,
          ),
          ContentType: mimeType,
          ContentLength:
            file.size,
          CacheControl:
            'private, max-age=3600',
        }),
      )

      /*
       * ---------------------------------------------------
       * UPDATE PROFILE
       * ---------------------------------------------------
       *
       * We store the PRIVATE R2 object key, not a public
       * R2 URL.
       *
       * The separate r2-profile-url function can later
       * generate a signed URL for displaying the image.
       */

      const oldAvatarUrl =
        profile.avatar_url

      const {
        error: updateError,
      } =
        await supabaseAdmin
          .from('profiles')
          .update({
            avatar_url: objectKey,
          })
          .eq(
            'id',
            user.id,
          )

      /*
       * ---------------------------------------------------
       * DATABASE UPDATE FAILED
       * ---------------------------------------------------
       *
       * Clean up the newly uploaded R2 object so we don't
       * leave an orphaned file in storage.
       */

      if (updateError) {
        console.error(
          'Failed to update profile avatar_url:',
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
            'Failed to clean up newly uploaded R2 object:',
            cleanupError,
          )
        }

        return errorResponse(
          request,
          'Profile image was uploaded but could not be linked to your profile.',
          500,
        )
      }

      /*
       * ---------------------------------------------------
       * DELETE PREVIOUS AVATAR
       * ---------------------------------------------------
       *
       * Only delete the previous object after the database
       * successfully points to the new image.
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
        } catch (deleteError) {
          /*
           * The new image is already active, so don't fail
           * the request just because an old object could not
           * be deleted.
           */

          console.error(
            'Failed to delete previous profile image:',
            deleteError,
          )
        }
      }

      /*
       * ---------------------------------------------------
       * SUCCESS
       * ---------------------------------------------------
       */

      return jsonResponse(
        request,
        {
          success: true,
          message:
            'Profile image uploaded successfully.',
          avatar_url: objectKey,
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
       * ---------------------------------------------------
       * GLOBAL ERROR HANDLER
       * ---------------------------------------------------
       */

      console.error(
        'r2-profile-upload error:',
        error,
      )

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to upload profile image.'

      return errorResponse(
        request,
        message,
        500,
      )
    }
  },
)