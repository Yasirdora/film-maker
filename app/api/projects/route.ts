/**
 * /api/projects — project collection endpoints.
 *
 *   GET  — list the authenticated user's active projects.
 *   POST — create a new project.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth-server";
import { validateOrigin } from "@/lib/security";
import {
    listProjects,
    createProject,
    ProjectLimitError,
    MAX_PROJECT_NAME_LENGTH,
    MAX_PROJECT_DESCRIPTION_LENGTH,
} from "@/lib/projects";

// ─── GET /api/projects ─────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await listProjects(session.user.id);
    return NextResponse.json({ projects });
}

// ─── POST /api/projects ────────────────────────────────────────────────────

const CreateSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Project name is required")
        .max(MAX_PROJECT_NAME_LENGTH, `Name must be under ${MAX_PROJECT_NAME_LENGTH} characters`),
    description: z
        .string()
        .trim()
        .max(MAX_PROJECT_DESCRIPTION_LENGTH)
        .optional(),
});

export async function POST(request: Request): Promise<Response> {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let input: z.infer<typeof CreateSchema>;
    try {
        const body = await request.json();
        input = CreateSchema.parse(body);
    } catch (err) {
        const message =
            err instanceof z.ZodError
                ? err.issues.map((i) => i.message).join("; ")
                : "Invalid request body";
        return NextResponse.json({ error: message }, { status: 400 });
    }

    try {
        const { uid } = await createProject({
            userId: session.user.id,
            name: input.name,
            description: input.description,
        });

        return NextResponse.json({ uid }, { status: 201 });
    } catch (err) {
        if (err instanceof ProjectLimitError) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        throw err;
    }
}
