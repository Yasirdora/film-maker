/**
 * Login page — uses the shared AuthCard shell.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth-server";
import { AuthCard } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
    title: "Sign in",
    description: "Sign in to Film-maker",
};

function isEmailSignInAvailable(): boolean {
    return Boolean(
        process.env.GMAIL_CLIENT_ID &&
        process.env.GMAIL_CLIENT_SECRET &&
        process.env.GMAIL_REFRESH_TOKEN &&
        process.env.GMAIL_SENDER,
    );
}

export default async function LoginPage() {
    // Already signed in — send them where they belong.
    const session = await getSession();
    if (session?.user) {
        redirect(session.user.name ? "/dashboard" : "/welcome");
    }

    const emailEnabled = isEmailSignInAvailable();

    return (
        <AuthCard>
            <Suspense fallback={null}>
                <LoginForm emailEnabled={emailEnabled} />
            </Suspense>
        </AuthCard>
    );
}
