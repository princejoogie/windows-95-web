const svg = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" shape-rendering="crispEdges">${body}</svg>`)}`
const paper =
  '<path fill="#fff" stroke="#000" d="M5.5 1.5h7v11h-7z"/><path stroke="#808080" d="M7 4.5h4m-4 2h4m-4 2h4"/>'
export const toolbarIcons: Readonly<Record<string, string>> = {
  'Up One Level': svg(
    '<path fill="#ffff00" stroke="#808000" d="M1.5 5.5h5v-2h5v2h3v9h-13z"/><path fill="#000" d="M8 1h2v2h2v2h-2v4H8V5H6V3h2z"/>',
  ),
  Cut: svg(
    '<path fill="none" stroke="#000" d="m3.5 1.5 8 11m1-11-8 11M4 9.5l-2 1v3l2 1 2-1v-3zm8 0-2 1v3l2 1 2-1v-3z"/>',
  ),
  Copy: svg(`<path fill="#fff" stroke="#000" d="M1.5 4.5h7v10h-7z"/>${paper}`),
  Paste: svg(
    `<path fill="#808000" stroke="#000" d="M1.5 3.5h10v11h-10z"/><path fill="#c0c0c0" stroke="#000" d="M4.5 1.5h4v3h-4z"/>${paper}`,
  ),
  Undo: svg('<path fill="#000080" d="M1 4h3V1l5 5-5 5V8H2V6h8v2h2v5H7v2h7V6h-2V4z"/>'),
  Delete: svg(
    '<path stroke="#800000" stroke-width="2" d="m3 3 10 10M13 3 3 13"/><path stroke="#ff0000" d="m2 2 10 10M12 2 2 12"/>',
  ),
  Properties: svg(`${paper}<path fill="#ffff00" stroke="#808000" d="m1 12 9-9 2 2-9 9H1z"/>`),
  'Large Icons': svg(
    '<path fill="#008080" stroke="#000" d="M1.5 1.5h4v4h-4zm9 0h4v4h-4zm-9 9h4v4h-4zm9 0h4v4h-4z"/>',
  ),
  'Small Icons': svg(
    '<path fill="#008080" d="M1 2h3v3H1zm0 6h3v3H1zm8-6h3v3H9zm0 6h3v3H9z"/><path stroke="#000" d="M5 3.5h3m5 0h3M5 9.5h3m5 0h3"/>',
  ),
  List: svg(
    '<path fill="#008080" d="M1 1h3v3H1zm0 5h3v3H1zm0 5h3v3H1z"/><path stroke="#000" d="M6 2.5h9m-9 5h9m-9 5h9"/>',
  ),
  Details: svg(
    '<path fill="#fff" stroke="#000" d="M.5.5h15v14H.5z"/><path fill="#c0c0c0" d="M1 1h14v3H1z"/><path stroke="#808080" d="M1 4.5h14m-9-4v14m5-14v14M1 8.5h14m-14 3h14"/>',
  ),
}
