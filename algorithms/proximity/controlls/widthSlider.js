import { Slider } from "./slider.js";

export class WidthSlider extends Slider {
  constructor(config) {
    super({ ...config, id: "edgeWidt", text: "Width" });

    this.min = 0.25;
    this.max = 4;
    this.step = 0.25;
    this.value = config?.value ?? 2;

    this.render();
  }
}
