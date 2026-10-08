/**
 * Navegador embutido de aplicativo (WhatsApp, Instagram, Facebook, LinkedIn): a chave de acesso
 * pode não funcionar nele, e a tela do convite pede para abrir o link no Chrome ou no Safari.
 */
export function abertoEmNavegadorDeAplicativo(userAgent: string): boolean {
  if (/WhatsApp|Instagram|FBAN|FBAV|LinkedInApp/i.test(userAgent)) return true;
  // WebView do Android se identifica com "; wv)"
  if (/Android/.test(userAgent) && /; wv\)/.test(userAgent)) return true;
  // No iPhone e no iPad, só os navegadores de verdade dizem "Safari/"
  return /iPhone|iPad/.test(userAgent) && !/Safari\//.test(userAgent);
}
