import { createClient } from "npm:@supabase/supabase-js@2";
import {
  S3Client,
  PutObjectCommand,
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const PRESIGNED_URL_EXPIRY = 15 * 60;

const allowedMimeTypes = new Set([
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
]);

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function sanitizeFileName(fileName: string) {
  const extensionIndex = fileName.lastIndexOf(".");
  const extension =
    extensionIndex >= 0
      ? fileName.slice(extensionIndex).toLowerCase()
      : "";

  const baseName =
    extensionIndex >= 0
      ? fileName.slice(0, extensionIndex)
      : fileName;

  const sanitizedBase = baseName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100);

  return `${sanitizedBase || "document"}${extension}`;
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function createR2Client() {
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = getRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(
        {
          error: "Authentication required",
        },
        401,
      );
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseAnonKey = getRequiredEnv("SUPABASE_ANON_KEY");

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          error: "Invalid or expired authentication session",
        },
        401,
      );
    }

    const body = await req.json();

    const fileName =
      typeof body.file_name === "string"
        ? body.file_name.trim()
        : "";

    const fileType =
      typeof body.file_type === "string"
        ? body.file_type.trim()
        : "";

    const fileSize = Number(body.file_size);

    const relatedType =
      typeof body.related_type === "string"
        ? body.related_type.trim()
        : null;

    const relatedId =
      typeof body.related_id === "string"
        ? body.related_id.trim()
        : null;

    if (!fileName) {
      return jsonResponse(
        {
          error: "File name is required",
        },
        400,
      );
    }

    if (!fileType) {
      return jsonResponse(
        {
          error: "File type is required",
        },
        400,
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return jsonResponse(
        {
          error: "A valid file size is required",
        },
        400,
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return jsonResponse(
        {
          error: "File size cannot exceed 50 MB",
        },
        413,
      );
    }

    if (!allowedMimeTypes.has(fileType)) {
      return jsonResponse(
        {
          error: "This file type is not supported",
        },
        400,
      );
    }

    const safeFileName = sanitizeFileName(fileName);

    const fileId = crypto.randomUUID();

    const storagePath = [
      "documents",
      user.id,
      `${fileId}-${safeFileName}`,
    ].join("/");

    const bucketName = getRequiredEnv("R2_BUCKET_NAME");

    const s3Client = createR2Client();

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: storagePath,
      ContentType: fileType,
      ContentLength: fileSize,
    });

    const uploadUrl = await getSignedUrl(
      s3Client,
      command,
      {
        expiresIn: PRESIGNED_URL_EXPIRY,
      },
    );

    return jsonResponse({
      success: true,
      upload_url: uploadUrl,
      storage_path: storagePath,
      file_id: fileId,
      uploaded_by: user.id,
      related_type: relatedType,
      related_id: relatedId,
      expires_in: PRESIGNED_URL_EXPIRY,
    });
  } catch (error) {
    console.error("document-upload error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create upload URL",
      },
      500,
    );
  }
});