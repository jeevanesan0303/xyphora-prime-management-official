import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRelatedTypes = new Set([
  "client",
  "project",
  "invoice",
  "expense",
  "employee",
  "company",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

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

    const fileName =
      typeof body.file_name === "string"
        ? body.file_name.trim()
        : "";

    const fileType =
      typeof body.file_type === "string"
        ? body.file_type.trim()
        : "";

    const fileSize = Number(body.file_size);

    const storagePath =
      typeof body.storage_path === "string"
        ? body.storage_path.trim()
        : "";

    const relatedType =
      typeof body.related_type === "string"
        ? body.related_type.trim()
        : "";

    const relatedId =
      typeof body.related_id === "string"
        ? body.related_id.trim() || null
        : null;

    const notes =
      typeof body.notes === "string"
        ? body.notes.trim()
        : "";

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

    if (!storagePath) {
      return jsonResponse(
        {
          error: "Storage path is required",
        },
        400,
      );
    }

    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0
    ) {
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

    if (!allowedRelatedTypes.has(relatedType)) {
      return jsonResponse(
        {
          error: "Invalid related document type",
        },
        400,
      );
    }

    if (
      !storagePath.startsWith(
        `documents/${user.id}/`,
      )
    ) {
      return jsonResponse(
        {
          error: "Invalid storage path",
        },
        403,
      );
    }

    const { data: document, error: insertError } =
      await supabase
        .from("documents")
        .insert({
          file_name: fileName,
          file_type: fileType,
          file_size: fileSize,
          storage_path: storagePath,
          related_type: relatedType,
          related_id: relatedId,
          upload_date: new Date().toISOString(),
          notes,
        })
        .select()
        .single();

    if (insertError) {
      console.error(
        "Document insert error:",
        insertError,
      );

      return jsonResponse(
        {
          error: "Unable to save document metadata",
          details: insertError.message,
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      document,
    });
  } catch (error) {
    console.error(
      "document-upload-complete error:",
      error,
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to complete document upload",
      },
      500,
    );
  }
});