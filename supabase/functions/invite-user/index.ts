import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the calling user is admin/director
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with caller's JWT to check their role
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin/director role using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "director"])
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Prístup zamietnutý. Iba Admin môže pozývať používateľov." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, full_name, role, temporary_password } = await req.json();

    // Validate inputs
    if (!email || !full_name || !temporary_password) {
      return new Response(JSON.stringify({ error: "Email, meno a heslo sú povinné." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (temporary_password.length < 8) {
      return new Response(JSON.stringify({ error: "Heslo musí mať aspoň 8 znakov." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["monter", "manager", "admin", "accountant", "director"];
    const assignRole = validRoles.includes(role) ? role : "monter";

    // Create the auth user with service role (bypasses signup restrictions)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: temporary_password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) {
      // Handle duplicate email
      if (createError.message?.includes("already been registered") || createError.message?.includes("already exists")) {
        return new Response(JSON.stringify({ error: "Používateľ s týmto e-mailom už existuje." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw createError;
    }

    // The handle_new_user trigger should auto-create profile + role,
    // but let's ensure the role is correct if not default 'monter'
    if (assignRole !== "monter" && newUser.user) {
      await adminClient
        .from("user_roles")
        .update({ role: assignRole })
        .eq("user_id", newUser.user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Používateľ ${full_name} (${email}) bol úspešne vytvorený.`,
        user_id: newUser.user?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("invite-user error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Interná chyba servera." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
