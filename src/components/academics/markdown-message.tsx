import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="space-y-2 [&_a]:underline [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_ol]:list-decimal [&_ol]:pl-4 [&_p+p]:mt-2 [&_table]:w-full [&_td]:border [&_td]:border-white/15 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-white/15 [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
