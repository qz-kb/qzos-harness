/** The package browser entry excludes Node filesystem output methods. */
declare module 'qrcode/lib/browser.js' {
  const renderer: { toCanvas: typeof import('qrcode').toCanvas }
  export default renderer
}
