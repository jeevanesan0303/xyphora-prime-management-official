import { createClient } from "npm:@supabase/supabase-js@2";
import {
  DeleteObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function createR2Client() {
  const accountId = getRequiredEnv("R2_ACCOUNT_ID");

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: getRequiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getRequiredEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

Deno.serve(async (req: Request) => {
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

    const documentId =
      typeof body.document_id === "string"
        ? body.document_id.trim()
        : "";

    if (!documentId) {
      return jsonResponse(
        {
          error: "Document ID is required",
        },
        400,
      );
    }

    const { data: document, error: documentError } =
      await supabase
        .from("documents")
        .select("id, storage_path")
        .eq("id", documentId)
        .maybeSingle();

    if (documentError) {
      console.error(
        "Document lookup error:",
        documentError,
      );

      return jsonResponse(
        {
          error: "Unable to retrieve document",
        },
        500,
      );
    }

    if (!document) {
      return jsonResponse(
        {
          error: "Document not found",
        },
        404,
      );
    }

    const expectedPrefix = `documents/${user.id}/`;

    if (
      !document.storage_path.startsWith(expectedPrefix)
    ) {
      return jsonResponse(
        {
          error: "You do not have permission to delete this document",
        },
        403,
      );
    }

    const bucketName = getRequiredEnv("R2_BUCKET_NAME");

    const r2Client = createR2Client();

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: document.storage_path,
      }),
    );

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId);

    if (deleteError) {
      console.error(
        "Database document deletion error:",
        deleteError,
      );

      return jsonResponse(
        {
          error:
            "The R2 file was deleted, but the database record could not be removed",
          details: deleteError.message,
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      document_id: documentId,
    });
  } catch (error) {
    console.error(
      "document-delete error:",
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete document",
      },
      500,
    );
  }
});