import "server-only";

import { Pinecone } from "@pinecone-database/pinecone";

import {
  buildPublicPassages,
  collegeNamespace,
  passageVectorId,
  readPineconeMatches,
  searchUnavailable,
  type PublicPassage,
} from "@/lib/ai/guest-college";
import { loadPublicCorpus } from "@/lib/ai/guest-reads";

type CollegeSource =
  | "about"
  | "admissions"
  | "department"
  | "course"
  | "event"
  | "announcement"
  | "document";

export async function searchCollegePassages(query: string) {
  const text = query.trim();
  if (!text) return JSON.stringify({ matches: [] });
  const provider = embedProvider();
  const index = provider ? collegeIndex(provider) : null;
  if (!index) return JSON.stringify({ error: searchUnavailable });
  try {
    const result = await index.documents.search({
      scoreBy: [{ type: "embed", field: "chunk_text", query: text }],
      topK: 5,
      includeFields: ["title", "source", "chunk_text"],
    });
    return JSON.stringify({
      matches: readPineconeMatches(
        result.matches.map((match) => ({
          metadata: {
            title: match.title,
            source: match.source,
            text: match.chunk_text,
          },
        })),
      ),
    });
  } catch (error) {
    console.error(error);
    return JSON.stringify({ error: searchUnavailable });
  }
}

export async function indexCollegeRecord(record: {
  source: CollegeSource;
  recordId: string;
  title: string;
  text: string;
  published: boolean;
}) {
  try {
    const passages =
      record.published && record.text.trim() ? passagesFor(record) : [];
    const provider = embedProvider();
    const index = provider ? collegeIndex(provider) : null;
    if (!index) return;
    await index.documents.delete({
      filter: {
        source: { $eq: record.source },
        recordId: { $eq: record.recordId },
      },
    });
    await upsertPassages(index, passages);
  } catch (error) {
    console.error(error);
  }
}

export async function reindexPublicCollege() {
  try {
    const passages = buildPublicPassages(await loadPublicCorpus());
    const provider = embedProvider();
    const index = provider ? collegeIndex(provider) : null;
    if (!index) return;
    await index.documents.delete({
      filter: {
        source: { $in: ["about", "admissions", "department", "course", "event", "announcement"] },
      },
    });
    await upsertPassages(index, passages);
  } catch (error) {
    console.error(error);
  }
}

export async function indexUploadedPdf(title: string, text: string): Promise<{ passages: number } | { error: string }> {
  const passages = buildPublicPassages({
    settings: null,
    departments: [],
    courses: [],
    events: [],
    announcements: [],
    documents: [{ id: crypto.randomUUID(), title, body: text }],
  });
  if (passages.length === 0) return { error: "That PDF has no readable text." };
  const provider = embedProvider();
  const index = provider ? collegeIndex(provider) : null;
  if (!index) return { error: "College search is not ready. Check the Pinecone keys." };
  try {
    await upsertPassages(index, passages);
    return { passages: passages.length };
  } catch (error) {
    console.error(error);
    return { error: "The PDF could not be added to search." };
  }
}

function passagesFor(record: {
  source: CollegeSource;
  recordId: string;
  title: string;
  text: string;
}): PublicPassage[] {
  const empty = {
    settings: null,
    departments: [],
    courses: [],
    events: [],
    announcements: [],
  };
  if (record.source === "about") {
    return buildPublicPassages({
      ...empty,
      settings: { name: record.title, about: record.text, admissionsInfo: "" },
    });
  }
  if (record.source === "admissions") {
    return buildPublicPassages({
      ...empty,
      settings: { name: record.title, about: "", admissionsInfo: record.text },
    });
  }
  if (record.source === "department") {
    return buildPublicPassages({
      ...empty,
      departments: [
        { id: record.recordId, name: record.title, description: record.text },
      ],
    });
  }
  if (record.source === "course") {
    return buildPublicPassages({
      ...empty,
      courses: [
        { id: record.recordId, name: record.title, description: record.text },
      ],
    });
  }
  if (record.source === "event") {
    return buildPublicPassages({
      ...empty,
      events: [
        { id: record.recordId, title: record.title, description: record.text },
      ],
    });
  }
  if (record.source === "document") {
    return buildPublicPassages({
      ...empty,
      documents: [{ id: record.recordId, title: record.title, body: record.text }],
    });
  }
  return buildPublicPassages({
    ...empty,
    announcements: [
      { id: record.recordId, title: record.title, body: record.text },
    ],
  });
}

function collegeIndex(provider: string) {
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  const name = process.env.PINECONE_INDEX?.trim();
  if (!apiKey || !name) return null;
  return new Pinecone({ apiKey })
    .index({ name })
    .namespace(collegeNamespace(provider));
}

function embedProvider() {
  const provider = process.env.AI_PROVIDER;
  if (provider === "gemini" || provider === "openai" || provider === "ollama")
    return provider;
  return null;
}

async function upsertPassages(
  index: NonNullable<ReturnType<typeof collegeIndex>>,
  passages: PublicPassage[],
) {
  const documents = passages.map((passage, ordinal) => ({
    _id: passageVectorId(passage.source, passage.recordId, ordinal),
    chunk_text: passage.text,
    title: passage.title,
    source: passage.source,
    recordId: passage.recordId,
  }));
  for (let indexStart = 0; indexStart < documents.length; indexStart += 40) {
    const batch = documents.slice(indexStart, indexStart + 40);
    if (batch.length > 0) await index.documents.upsert({ documents: batch });
  }
}
