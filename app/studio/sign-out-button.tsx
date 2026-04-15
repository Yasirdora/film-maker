"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handle() {
        setLoading(true);
        try {
            await signOut();
            router.push("/login");
            router.refresh();
        } catch {
            setLoading(false);
        }
    }

    return (
        <Button
            variant="secondary"
            size="md"
            fullWidth
            disabled={loading}
            onClick={handle}
        >
            {loading ? "Signing out…" : "Sign out"}
        </Button>
    );
}
