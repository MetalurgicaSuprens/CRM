import { describe, expect, it } from "vitest";
import { abertoEmNavegadorDeAplicativo } from "./navegador";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const WEBVIEW_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const APP_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const INSTAGRAM = `${APP_IPHONE} Instagram 340.0.0.0`;
const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

describe("abertoEmNavegadorDeAplicativo", () => {
  it("reconhece o navegador embutido do Android", () => {
    expect(abertoEmNavegadorDeAplicativo(WEBVIEW_ANDROID)).toBe(true);
  });

  it("reconhece o navegador embutido do iPhone, que não se diz Safari", () => {
    expect(abertoEmNavegadorDeAplicativo(APP_IPHONE)).toBe(true);
    expect(abertoEmNavegadorDeAplicativo(INSTAGRAM)).toBe(true);
  });

  it("deixa passar os navegadores de verdade", () => {
    expect(abertoEmNavegadorDeAplicativo(CHROME_ANDROID)).toBe(false);
    expect(abertoEmNavegadorDeAplicativo(SAFARI_IPHONE)).toBe(false);
    expect(abertoEmNavegadorDeAplicativo(CHROME_WINDOWS)).toBe(false);
  });
});
