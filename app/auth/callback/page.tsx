"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/app/lib/supabase-browser";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const sb = getSupabaseBrowser();

    function redirect() {
      const plan = localStorage.getItem("ciq_signup_plan");
      const dest = plan ? `/?welcome=${plan}` : "/";
      router.replace(dest);
    }

    sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        redirect();
      }
    });

    sb.auth.getSession().then(({ data }) => {
      if (data.session) redirect();
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
