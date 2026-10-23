/** Build a visitor URL containing only the public identifier.
 * @param apiUrl - Configured QZOS business API origin.
 * @param publicId - Public web or JS publication identifier.
 * @param type - Existing web (1) or JS (2) publication type.
 * @returns The encoded visitor URL without account or API credentials.
 */
export function publicationUrl(apiUrl: string, publicId: string, type: number): string {
  if (![1, 2].includes(type) || !publicId || publicId.length > 200) throw new Error('Public publication required')
  if (!apiUrl) throw new Error('请先配置公开访客入口地址 / Public visitor origin is not configured')
  const api = new URL(apiUrl)
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password) throw new Error('Invalid publication origin')
  return `${api.origin}/chat/${encodeURIComponent(publicId)}`
}
/** Build an HTML-escaped iframe for the existing QZOS visitor page.
 * @param url - Public visitor URL.
 * @param instance - Unique name isolating the iframe visitor session.
 * @returns The copyable iframe snippet.
 */
export function publicationEmbed(url: string, instance: string): string {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  return `<iframe src="${escape(url)}" name="qzos-publish:${escape(instance)}" title="QZOS" style="width:100%;height:640px;border:0"></iframe>`
}
