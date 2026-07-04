import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { PenTool, Users, Layers, Sparkles } from "lucide-react";

export default function Landing() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <PenTool className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">CollaboDraw</h1>
        <p className="mt-4 max-w-xl text-balance text-muted-foreground">
          A real-time collaborative whiteboard. Sketch ideas, drop sticky notes, chat, and design together with your
          team — instantly synced across every cursor.
        </p>
        <Button size="lg" className="mt-8" onClick={login} data-testid="button-login">
          Log in to get started
        </Button>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { icon: Users, title: "Live presence", desc: "See collaborators' cursors and laser pointers in real time." },
            { icon: Layers, title: "Multi-page boards", desc: "Organize ideas across pages with drawing, text, and sticky notes." },
            { icon: Sparkles, title: "Export anywhere", desc: "Save your work as PNG, JPEG, or PDF whenever you like." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-card-border bg-card p-6 text-left">
              <Icon className="mb-3 h-6 w-6 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
