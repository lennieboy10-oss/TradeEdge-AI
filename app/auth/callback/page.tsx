"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/app/lib/supabase-browser";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const sb = getSupabaseBrowser();

    // For hash-based tokens (email confirmation links), supabase-js auto-parses
    // the URL hash and establishes a session. We just wait for it then redirect.
    sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        router.replace("/");
      }
    });

    // If already signed in (e.g. navigated here directly), redirect immediately
    sb.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080a10] text-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-[#00e676] border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-[#6b7280] text-sm">Confirming your account…</p>
      </div>
    </div>
  );
}
