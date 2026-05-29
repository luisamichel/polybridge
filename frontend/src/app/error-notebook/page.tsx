import { BookOpen } from "lucide-react";

export default function ErrorNotebookPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface ring-1 ring-border">
          <BookOpen className="h-7 w-7 text-zinc-500" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Error Notebook
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Your personal collection of mistakes and corrections will appear here.
          Track recurring errors and review them to build lasting fluency.
        </p>
        <div className="mt-8 w-full rounded-xl border border-dashed border-border bg-surface/50 px-6 py-10">
          <p className="text-sm text-zinc-600">No errors recorded yet</p>
          <p className="mt-1 text-xs text-zinc-700">
            Start a chat session to begin collecting corrections
          </p>
        </div>
      </div>
    </div>
  );
}
