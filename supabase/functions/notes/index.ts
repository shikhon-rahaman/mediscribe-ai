import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// In-memory rate limiting
const requestTimestamps = new Map<string, number[]>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const timestamps = requestTimestamps.get(clientIp) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  requestTimestamps.set(clientIp, recent);
  return true;
}

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (!checkRateLimit(clientIp)) {
    return errorResponse(429, "Rate limit exceeded. Please try again later.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials not configured");
    return errorResponse(500, "Failed to retrieve notes. Please try again.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const noteId = url.searchParams.get("id");

      if (noteId) {
        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(noteId)) {
          return errorResponse(400, "Invalid note ID.");
        }

        const { data, error } = await supabase
          .from("clinical_notes")
          .select("*")
          .eq("id", noteId)
          .maybeSingle();

        if (error) {
          console.error("Database query error:", error.message);
          return errorResponse(500, "Failed to retrieve note. Please try again.");
        }

        if (!data) {
          return errorResponse(404, "Note not found.");
        }

        return new Response(
          JSON.stringify(data),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // List all notes with pagination
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = Math.min(
        parseInt(url.searchParams.get("limit") || "20", 10),
        50,
      );
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from("clinical_notes")
        .select(
          "id, transcript, labeled_transcript, entities, soap_note, safety_flags, created_at, updated_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Database query error:", error.message);
        return errorResponse(500, "Failed to retrieve notes. Please try again.");
      }

      return new Response(
        JSON.stringify({
          notes: data || [],
          total: count || 0,
          page,
          limit,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method === "DELETE") {
      const noteId = url.searchParams.get("id");
      if (!noteId) {
        return errorResponse(400, "Note ID is required.");
      }

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(noteId)) {
        return errorResponse(400, "Invalid note ID.");
      }

      const { error } = await supabase
        .from("clinical_notes")
        .delete()
        .eq("id", noteId);

      if (error) {
        console.error("Database delete error:", error.message);
        return errorResponse(500, "Failed to delete note. Please try again.");
      }

      return new Response(
        JSON.stringify({ message: "Note deleted successfully." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return errorResponse(405, "Method not allowed.");
  } catch (err) {
    console.error("Notes endpoint error:", err);
    return errorResponse(500, "Failed to process request. Please try again.");
  }
});
