import type { Components } from "react-markdown";

export const chatMarkdownComponents: Components = {
  p: ({ node, ...props }) => <p className="whitespace-pre-wrap" {...props} />,
  ul: ({ node, ...props }) => (
    <ul className="list-disc space-y-1 pl-5" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="list-decimal space-y-1 pl-5" {...props} />
  ),
  li: ({ node, ...props }) => <li className="pl-1" {...props} />,
  strong: ({ node, ...props }) => (
    <strong className="font-semibold text-white" {...props} />
  ),
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  h1: ({ node, ...props }) => (
    <h1 className="mt-2 text-lg font-bold text-white" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mt-2 text-base font-bold text-white" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mt-2 text-sm font-bold text-white" {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="my-2 max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="border-b border-border-subtle" {...props} />
  ),
  tbody: ({ node, ...props }) => <tbody {...props} />,
  tr: ({ node, ...props }) => (
    <tr className="border-b border-border-subtle/80 last:border-0" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th
      className="px-2 py-1.5 font-semibold text-foreground first:pl-0 last:pr-0"
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td
      className="px-2 py-1.5 text-zinc-300 first:pl-0 last:pr-0"
      {...props}
    />
  ),
};
