import Link from "next/link"

import {
  CampusIllustration,
  LibraryIllustration,
  PathIllustration,
  QuadIllustration,
} from "@/components/landing/illustrations"
import { LandingHeader } from "@/components/landing/landing-header"
import { Button } from "@/components/ui/button"
import type { CollegeSettings } from "@/actions/college/catalog/getQueries"

const highlights = [
  { title: "Classrooms that stay close", text: "Small groups, attentive teachers, and time to ask the next question." },
  { title: "Grounds you can walk", text: "Lawns, courts, and quiet corners between lectures." },
  { title: "A college that knows your name", text: "Staff who stay with a student from the first week to the last exam." },
]

export function LandingView({ settings }: { settings: CollegeSettings | null }) {
  const name = settings?.name?.trim() || "Our college"
  const about =
    collegeText(settings?.about) ||
    `${name} is a place to study with care. Mornings begin in classrooms, afternoons open onto the grounds, and the people here stay long enough to know one another.`
  const admissions =
    collegeText(settings?.admissionsInfo) ||
    "Each year we welcome a new class. Families are invited to walk the campus, meet teachers, and ask about the course that fits."

  return (
    <div className="bg-[#f7f4ee] text-[#243044]">
      <LandingHeader collegeName={name} />
      <main id="main">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="text-sm font-medium tracking-wide text-[#8a6a4a] uppercase">Welcome</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {`Study, gather, and grow at ${name}.`}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5c677a]">{about}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button className="h-11 rounded-xl bg-[#101a2c] px-5 text-white hover:bg-[#101a2c]/90" asChild>
                <a href="#admissions">Admissions</a>
              </Button>
              <Button variant="outline" className="h-11 rounded-xl bg-white px-5" asChild>
                <a href="#campus">Life on campus</a>
              </Button>
            </div>
          </div>
          <CampusIllustration />
        </section>

        <section className="border-y border-[#eadfce] bg-white">
          <ul className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-8 sm:grid-cols-3">
            {highlights.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#5c677a]">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="about" className="scroll-mt-24 mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-medium text-[#8a6a4a]">About</p>
            <h2 className="mt-2 text-3xl font-semibold">A campus built for unhurried learning</h2>
            <p className="mt-4 text-sm leading-7 text-[#5c677a]">{about}</p>
            <p className="mt-4 text-sm leading-7 text-[#5c677a]">
              Lectures sit beside laboratories and libraries. Evenings belong to societies, sport, and the long walk back across the lawn.
            </p>
          </div>
          <LibraryIllustration />
        </section>

        <section id="academics" className="scroll-mt-24 bg-[#101a2c] py-16 text-white">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm text-white/60">Academics</p>
              <h2 className="mt-2 text-3xl font-semibold">Subjects taught with attention</h2>
              <p className="mt-4 text-sm leading-7 text-white/70">
                Courses are arranged so a student can go deep without losing the rest of college life. Departments share teachers, studios, and the same quadrangle.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                ["Sciences", "Laboratories, field notes, and time at the bench."],
                ["Humanities", "Reading rooms, seminars, and long essays."],
                ["Commerce", "Markets, accounts, and the practice of a clear argument."],
                ["Arts", "Studios, stages, and work that is meant to be seen."],
              ].map(([title, text]) => (
                <li key={title} className="rounded-3xl bg-white/6 p-5">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/65">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="campus" className="scroll-mt-24 mx-auto w-full max-w-6xl px-5 py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-[#8a6a4a]">Campus life</p>
            <h2 className="mt-2 text-3xl font-semibold">The day does not end when the bell does</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-[28px] bg-white p-4">
              <QuadIllustration />
              <h3 className="mt-4 text-lg font-semibold">The grounds</h3>
              <p className="mt-2 text-sm leading-6 text-[#5c677a]">
                Shade, sport, and benches under trees. The campus is meant to be walked.
              </p>
            </article>
            <article className="rounded-[28px] bg-white p-4">
              <LibraryIllustration />
              <h3 className="mt-4 text-lg font-semibold">Societies</h3>
              <p className="mt-2 text-sm leading-6 text-[#5c677a]">
                Music, debate, design, and the clubs students start when an idea will not wait.
              </p>
            </article>
            <article className="rounded-[28px] bg-white p-4">
              <PathIllustration />
              <h3 className="mt-4 text-lg font-semibold">Gatherings</h3>
              <p className="mt-2 text-sm leading-6 text-[#5c677a]">
                Festivals, matches, and evenings when the whole college comes outside.
              </p>
            </article>
          </div>
        </section>

        <section id="admissions" className="scroll-mt-24 mx-auto grid w-full max-w-6xl items-center gap-8 px-5 pb-16 lg:grid-cols-2">
          <PathIllustration />
          <div className="rounded-[28px] bg-white p-8">
            <p className="text-sm font-medium text-[#8a6a4a]">Admissions</p>
            <h2 className="mt-2 text-3xl font-semibold">Begin the year with us</h2>
            <p className="mt-4 text-sm leading-7 whitespace-pre-wrap text-[#5c677a]">{admissions}</p>
            <Button className="mt-6 h-11 rounded-xl bg-[#f3b7d4] px-5 text-[#243044] hover:bg-[#f3b7d4]/90" asChild>
              <a href="#visit">Plan a visit</a>
            </Button>
          </div>
        </section>

        <section id="visit" className="scroll-mt-24 border-t border-[#eadfce] bg-white">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-14 md:grid-cols-3">
            <div className="md:col-span-3">
              <h2 className="text-3xl font-semibold">Come and see {name}</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[#5c677a]">
                The office is open on working days. Write or call, and we will walk you from the gate to the hall.
              </p>
            </div>
            <VisitItem label="Address" value={settings?.address?.trim() || "The campus gate, ask at reception"} />
            <VisitItem label="Phone" value={settings?.phone?.trim() || "Call the front office"} />
            <VisitItem label="Email" value={settings?.email?.trim() || "Write to the college office"} />
          </div>
          <footer className="border-t border-[#eadfce]">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-sm text-[#7b8494] sm:flex-row sm:items-center sm:justify-between">
              <p>{name}</p>
              <Link href="/login" className="hover:text-[#243044]">
                Sign in
              </Link>
            </div>
          </footer>
        </section>
      </main>
    </div>
  )
}

function collegeText(value: string | undefined) {
  const text = value?.trim() ?? ""
  if (!text) return ""
  if (text.startsWith("Update this introduction")) return ""
  if (text.startsWith("Admission steps, eligibility")) return ""
  return text
}

function VisitItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-[#f7f4ee] p-5">
      <p className="text-xs tracking-wide text-[#8a6a4a] uppercase">{label}</p>
      <p className="mt-2 text-sm leading-6">{value}</p>
    </div>
  )
}
