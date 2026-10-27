const root = new URL("../../", import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const name = specifier.slice(2)
    const file = name.endsWith(".ts") || name.endsWith(".tsx") ? name : `${name}.ts`
    return nextResolve(new URL(`src/${file}`, root).href, context)
  }
  return nextResolve(specifier, context)
}
