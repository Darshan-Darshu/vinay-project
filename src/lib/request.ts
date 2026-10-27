import { connection } from "next/server"

export async function beginRequest() {
  await connection()
}
