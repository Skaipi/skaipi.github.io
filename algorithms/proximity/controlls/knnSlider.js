import { Slider } from "./slider.js";

export class KNNSlider extends Slider {
  constructor(config) {
    super({ ...config, id: "knn", text: "K" });

    this.min = 1;
    this.max = 20;
    this.step = 1;
    this.value = config?.value ?? 5;

    this.render();
  }
}
