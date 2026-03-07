import { Slider } from "./slider.js";

export class RankSlider extends Slider {
  constructor(config) {
    super({ ...config, id: "rankThreshold", text: "Rank diff" });
    this.min = 0;
    this.max = 5;
    this.step = 1;
    this.value = config?.value ?? 1;

    this.render();
  }
}
