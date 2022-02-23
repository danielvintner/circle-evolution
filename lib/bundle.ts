const file = "./bundled/manager.js"
const text = Deno.readTextFile(file);

const regex = RegExp(`const importMeta = \{
.*url: ".*",
.*main: import.meta.main
\};`)

text.then((response) => {
    let text = response
        .replace(regex, '')
        .replace('new URL("worker.ts", importMeta.url).href', '"worker.js"')
    return Deno.writeTextFile(file, text)
});

