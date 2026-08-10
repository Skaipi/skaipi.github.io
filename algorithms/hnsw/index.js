"use strict";

import { Controller } from "./controllers/controller.js";
import { DEFAULT_PALETTE_ID } from "./palettes.js";

window.addEventListener("load", () => {
  const canvas = document.getElementById("canvas");
  const downloadButton = document.getElementById("download-render");
  const interactiveClient = new Controller(canvas, { paletteId: getSelectedPaletteId() });

  for (const input of document.querySelectorAll('input[name="palette"]')) {
    input.checked = input.value === interactiveClient.paletteId;
    input.addEventListener("change", (event) => {
      if (event.target.checked) {
        interactiveClient.changePalette(event.target.value);
      }
    });
  }

  downloadButton?.addEventListener("click", () => {
    interactiveClient.downloadRender();
  });

  window.addEventListener("resize", () => {
    interactiveClient.resize();
  });

  interactiveClient.draw();
});

function getSelectedPaletteId() {
  return document.querySelector('input[name="palette"]:checked')?.value ?? DEFAULT_PALETTE_ID;
}
