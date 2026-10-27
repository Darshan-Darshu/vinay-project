"use client"

import { createContext, useContext } from "react"

type EditorApi = {
  editable: boolean
  openNew: () => void
  openId: (id: string) => void
}

export const EditorContext = createContext<EditorApi>({
  editable: false,
  openNew: () => {},
  openId: () => {},
})

export function useRecordEditor() {
  return useContext(EditorContext)
}
