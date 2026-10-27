import { GuestChatDock } from "@/components/academics/chat-dock"

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      {children}
      <GuestChatDock />
    </div>
  )
}
