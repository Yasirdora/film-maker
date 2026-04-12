/**
 * Auth-flow layout — full-bleed cinematic shell.
 *
 * The auth pages render a single hero card centered in the viewport. We
 * use dvh (dynamic viewport height) so the layout stays stable when
 * mobile Safari's address bar hides/shows, and respect safe-area insets
 * so nothing lives under the notch or home indicator.
 */

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className="grid min-h-dvh place-items-center overflow-hidden bg-neutral-50 antialiased dark:bg-neutral-950"
            style={{
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)",
            }}
        >
            {children}
        </div>
    );
}
