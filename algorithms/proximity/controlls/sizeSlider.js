import { Slider } from "./slider.js";

export class SizeSlider extends Slider {
  constructor(config) {
    super({ ...config, id: "pointSize", text: "Size" });

    this.min = 0;
    this.max = 5;
    this.step = 1;
    this.value = config?.value ?? 4;

    this.render();
  }
}
